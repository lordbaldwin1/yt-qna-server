import { Request, Response } from "express";
import { db } from "../db";
import { transcriptChunksTable, videosTable } from "../db/schema";
import { YoutubeTranscript, type TranscriptResponse } from 'youtube-transcript';
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const addVideo = async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const videoId = extractYoutubeVideoId(url);

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY}&part=snippet,contentDetails`);
    const data = await response.json();

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    const video = await db.insert(videosTable).values({
      youtubeVideoId: videoId,
      title: data.items[0].snippet.title,
      description: data.items[0].snippet.description,
      thumbnailUrl: data.items[0].snippet.thumbnails.default.url,
      url: url,
      createdAt: new Date(),
    }).returning();

    const chunks = chunkTranscript(transcript);
    await embedChunks(chunks, video[0].id);

    if (video) {
      return res.status(200).json({ message: "Video added", data: video });
    } else {
      return res.status(400).json({ error: "Failed to add video", code: "INTERNAL_ERROR" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch video data", code: "INTERNAL_ERROR" });
  }
};

const extractYoutubeVideoId = (url: string) => {
  const videoId = url.split("v=")[1];
  return videoId;
};

const chunkTranscript = (transcript: TranscriptResponse[], elementsPerChunk: number = 15, overlap: number = 3) => {
  const chunks: { text: string; startTime: number; endTime: number }[] = [];
  for (let i = 0; i < transcript.length; i += elementsPerChunk - overlap) {
    const chunk = transcript.slice(i, i + elementsPerChunk);
    if (chunk.length === 0) break;

    const text = chunk.map((t) => t.text).join(" ");
    const startTime = chunk[0].offset;
    const endTime = chunk[chunk.length - 1].offset + chunk[chunk.length - 1].duration;
    chunks.push({ text, startTime, endTime });
  }

  return chunks;
}

const embedChunks = async (chunks: { text: string; startTime: number; endTime: number }[], videoId: number) => {
  try {
    let processedChunkCount = 0;
    for (let i = 0; i < chunks.length; i += 100) {
      const chunkBatch = chunks.slice(i, i + 100);
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: chunkBatch.map((chunk) => chunk.text),
        config: {
          taskType: "SEMANTIC_SIMILARITY",
        },
      });

      if (!response.embeddings) {
        throw new Error("No embeddings returned");
      }

      for (let j = 0; j < response.embeddings.length; j++) {
        await db.insert(transcriptChunksTable).values({
          videoId: videoId,
          text: chunkBatch[j].text,
          startTime: chunkBatch[j].startTime,
          endTime: chunkBatch[j].endTime,
          embedding: response.embeddings[j].values ?? [],
        });
      }
      processedChunkCount += chunkBatch.length;
    }
  } catch (error) {
    console.error(error);
    throw new Error("Failed to embed chunks");
  }
};




