import { Request, Response } from "express";
import { db } from "../db";
import { videosTable } from "../db/schema";

export const addVideo = async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const videoId = extractYoutubeVideoId(url);

  console.log(videoId);

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY}&part=snippet,contentDetails`);
    const data = await response.json();
    console.log(data.items[0].snippet.title);
    console.log(data.items[0].snippet.description);
    console.log(data.items[0].snippet.thumbnails.default.url);

    const video = await db.insert(videosTable).values({
      youtubeVideoId: videoId,
      title: data.items[0].snippet.title,
      description: data.items[0].snippet.description,
      thumbnailUrl: data.items[0].snippet.thumbnails.default.url,
      url: url,
      createdAt: new Date(),
    });
    
    if (video) {
      return res.status(200).json({ message: "Video added", data: video });
    } else {
      return res.status(400).json({ error: "Failed to add video" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch video data" });
  }
};

const extractYoutubeVideoId = (url: string) => {
  const videoId = url.split("v=")[1];
  return videoId;
};
