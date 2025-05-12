import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { cosineDistance, sql, gt, desc, eq, and } from "drizzle-orm";
import {
  questionsTable,
  transcriptChunksTable,
  videosTable,
} from "../db/schema";
import { db } from "../db";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to get embeddings
async function getEmbedding(text: string) {
  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: [text],
    config: { taskType: "SEMANTIC_SIMILARITY" },
  });
  
  if (!response.embeddings || !response.embeddings[0].values) {
    throw new Error("No embeddings returned");
  }
  
  return response.embeddings[0].values;
}

export const askQuestion = async (req: Request, res: Response) => {
  try {
    const { question, videoId } = req.body;

    if (!question || !videoId) {
      return res
        .status(400)
        .json({ error: "Question and videoId are required" });
    }

    const numericVideoId = Number(videoId);
    if (isNaN(numericVideoId)) {
      return res.status(400).json({ error: "Invalid videoId" });
    }
    const video = await db.query.videosTable.findFirst({
      where: (videos, { eq }) => eq(videos.id, numericVideoId),
    });
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const questionEmbedding = await getEmbedding(question);

    const similarity = sql<number>`1 - (${cosineDistance(
      transcriptChunksTable.embedding,
      questionEmbedding
    )})`;

    const similarChunks = await db
      .select({ text: transcriptChunksTable.text, similarity, startTime: transcriptChunksTable.startTime })
      .from(transcriptChunksTable)
      .where(
        and(
          gt(similarity, 0.5),
          eq(transcriptChunksTable.videoId, numericVideoId)
        )
      )
      .orderBy((t) => desc(t.similarity))
      .limit(20);

    console.log(`Found ${similarChunks.length} similar chunks`);
    
    const context = similarChunks.map((chunk) => chunk.text).join(" ");
    console.log(`Context length: ${context.length} characters`);
    
    const answerSimilarity = sql<number>`1 - (${cosineDistance(
      questionsTable.answerEmbedding,
      questionEmbedding
    )})`;

    const relevantPreviousQA = await db
      .select({ 
        question: questionsTable.question, 
        answer: questionsTable.answer,
        similarity: answerSimilarity 
      })
      .from(questionsTable)
      .where(
        and(
          gt(answerSimilarity, 0.6),
          eq(questionsTable.videoId, numericVideoId)
        )
      )
      .orderBy((t) => desc(t.similarity))
      .limit(3);
    
    console.log(`Found ${relevantPreviousQA.length} relevant previous Q&As`);

    const previousQAContext = relevantPreviousQA.length > 0 
      ? `Previous relevant information from our conversation:\n${
          relevantPreviousQA.map(qa => 
            `Question: ${qa.question}\nAnswer: ${qa.answer}`
          ).join('\n\n')
        }\n\n`
      : '';
    
    const mostRelevantTimestamp = similarChunks[0]?.startTime ?? 0;
    const prompt = `
      Here is context of the video:
      ${context}

      ${previousQAContext}Question: ${question}

      Answer the question and relate it to the video.
    `.trim();
    
    console.log("Prompt:", prompt.substring(0, 200) + "...");
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullAnswer = '';
    
    try {
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: [prompt],
      });

      for await (const chunk of stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          fullAnswer += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      const answerEmbedding = await getEmbedding(fullAnswer);

      await db.insert(questionsTable).values({
        question,
        answer: fullAnswer,
        videoId: numericVideoId,
        mostRelevantTimestamp,
        askedAt: new Date(),
        answerEmbedding: answerEmbedding,
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Streaming error:", error);
      res.write(`data: ${JSON.stringify({ error: "Error during streaming" })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("askQuestion error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
