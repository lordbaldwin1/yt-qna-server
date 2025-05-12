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

    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: [question],
      config: { taskType: "SEMANTIC_SIMILARITY" },
    });
    if (!response.embeddings) {
      return res.status(400).json({ error: "No embeddings returned" });
    }
    const questionEmbedding = response.embeddings[0].values;

    if (!questionEmbedding) {
      return res.status(400).json({ error: "No question embedding returned" });
    }

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
      .limit(8);

    const context = similarChunks.map((chunk) => chunk.text).join(" ");
    const mostRelevantTimestamp = similarChunks[0]?.startTime ?? 0;
    const prompt = `
      You are a helpful assistant that can answer questions about the video with the following context:
      ${context}

      Question: ${question}

      Answer the question based on the context and your knowledge of related topics.
    `.trim();

    const answerResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [prompt],
    });

    const answer = answerResponse.candidates?.[0]?.content ?? "No answer found";

    let answerText = "No answer found";
    if (
      typeof answer === "object" &&
      Array.isArray(answer.parts) &&
      answer.parts[0]?.text
    ) {
      answerText = answer.parts[0].text;
    } else if (typeof answer === "string") {
      answerText = answer;
    }

    await db.insert(questionsTable).values({
      question,
      answer: answerText,
      videoId: numericVideoId,
      mostRelevantTimestamp,
      askedAt: new Date(),
    });
    

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("askQuestion error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
