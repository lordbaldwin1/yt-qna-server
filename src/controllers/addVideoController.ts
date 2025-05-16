import { Request, Response } from "express";
import { db } from "../db";
import { transcriptChunksTable, videosTable } from "../db/schema";
import { YoutubeTranscript, type TranscriptResponse } from 'youtube-transcript';
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { eq } from "drizzle-orm";
import { AddVideoRequest, ApiResponse, Video } from "../types/api";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const addVideo = async (req: Request, res: Response) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    const response: ApiResponse<null> = {
      message: "URL is required"
    };
    return res.status(400).json(response);
  }

  const videoId = extractYoutubeVideoId(videoUrl);
  
  if (!videoId) {
    const response: ApiResponse<null> = {
      message: "Invalid YouTube URL"
    };
    return res.status(400).json(response);
  }

  const duplicateVideo = await db.query.videosTable.findFirst({
    where: eq(videosTable.youtubeVideoId, videoId),
  });

  if (duplicateVideo) {
    const response: ApiResponse<null> = {
      message: "Video already exists"
    };
    return res.status(400).json(response);
  }

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY}&part=snippet,contentDetails`);
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      const errorResponse: ApiResponse<null> = {
        message: "Video not found on YouTube"
      };
      return res.status(404).json(errorResponse);
    }

    // Generate the embed URL for the video
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    const video = await db.insert(videosTable).values({
      youtubeVideoId: videoId,
      title: data.items[0].snippet.title,
      description: data.items[0].snippet.description,
      thumbnailUrl: data.items[0].snippet.thumbnails.default.url,
      url: videoUrl,
      embedUrl: embedUrl,
      createdAt: new Date(),
    }).returning();

    const chunks = chunkTranscript(transcript);
    await embedChunks(chunks, video[0].id);

    if (video) {
      const successResponse: ApiResponse<Video> = {
        message: "Video added successfully",
        data: video[0] as Video
      };
      return res.status(200).json(successResponse);
    } else {
      const errorResponse: ApiResponse<null> = {
        message: "Failed to add video"
      };
      return res.status(400).json(errorResponse);
    }
  } catch (error) {
    console.error(error);
    const errorResponse: ApiResponse<null> = {
      message: "Failed to fetch video data"
    };
    return res.status(500).json(errorResponse);
  }
};

const extractYoutubeVideoId = (url: string): string | null => {
  try {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Error extracting YouTube video ID:", error);
    return null;
  }
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




