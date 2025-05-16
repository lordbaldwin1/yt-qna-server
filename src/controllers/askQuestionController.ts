import { WebSocket } from "ws";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { cosineDistance, sql, gt, desc, eq, and } from "drizzle-orm";
import {
  questionsTable,
  transcriptChunksTable,
} from "../db/schema";
import { db } from "../db";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const handleAskQuestionWS = async (ws: WebSocket, question: string, videoId: string) => {
  try {
    console.log(question, videoId);
    if (!question || !videoId) {
      ws.send(JSON.stringify({ 
        type: "error", 
        error: "Question and videoId are required" 
      }));
      return;
    }

    const numericVideoId = Number(videoId);
    if (isNaN(numericVideoId)) {
      ws.send(JSON.stringify({ 
        type: "error", 
        error: "Invalid videoId" 
      }));
      return;
    }
    
    const video = await db.query.videosTable.findFirst({
      where: (videos, { eq }) => eq(videos.id, numericVideoId),
    });
    
    if (!video) {
      ws.send(JSON.stringify({ 
        type: "error", 
        error: "Video not found" 
      }));
      return;
    }

    const questionEmbedding = await getEmbedding(question);

    const similarity = sql<number>`1 - (${cosineDistance(
      transcriptChunksTable.embedding,
      questionEmbedding
    )})`;

    const similarChunks = await db
      .select({
        text: transcriptChunksTable.text,
        similarity,
        startTime: transcriptChunksTable.startTime,
      })
      .from(transcriptChunksTable)
      .where(
        and(
          gt(similarity, 0.5),
          eq(transcriptChunksTable.videoId, numericVideoId)
        )
      )
      .orderBy((t) => desc(t.similarity))
      .limit(20);

    const context = similarChunks.map((chunk) => chunk.text).join(" ");

    const answerSimilarity = sql<number>`1 - (${cosineDistance(
      questionsTable.answerEmbedding,
      questionEmbedding
    )})`;

    const relevantPreviousQA = await db
      .select({
        question: questionsTable.question,
        answer: questionsTable.answer,
        similarity: answerSimilarity,
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

    const previousQAContext =
      relevantPreviousQA.length > 0
        ? `Previous relevant information from our conversation:\n${relevantPreviousQA
            .map((qa) => `Question: ${qa.question}\nAnswer: ${qa.answer}`)
            .join("\n\n")}\n\n`
        : "";

    const mostRelevantTimestamp = similarChunks[0]?.startTime ?? 0;
    const prompt = `
      Here is context of the video:
      ${context}

      ${previousQAContext}Question: ${question}

      Answer the question and relate it to the video.
    `.trim();

    let fullAnswer = "";

    try {
      ws.send(JSON.stringify({ 
        type: "processing",
        message: "Processing your question..."
      }));

      const stream = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: [prompt],
      });

      for await (const chunk of stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          fullAnswer += text;
          ws.send(JSON.stringify({ 
            type: "chunk", 
            message:text,
            timestamp: new Date().toISOString()
          }));
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

      ws.send(JSON.stringify({ 
        type: "complete", 
        timestamp: mostRelevantTimestamp,
        message: "Answer complete"
      }));
    } catch (error) {
      console.error("Streaming error:", error);
      ws.send(JSON.stringify({ 
        type: "error", 
        error: "Error during AI response generation" 
      }));
    }
  } catch (error) {
    console.error("askQuestion error:", error);
    ws.send(JSON.stringify({ 
      type: "error", 
      error: "Internal server error" 
    }));
  }
};

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
