import { Request, Response } from "express";
import { db } from "../db";
import { videosTable } from "../db/schema";

export const listVideos = async (req: Request, res: Response) => {
  try {
    const videos = await db.select().from(videosTable);
    res.status(200).json(videos);
  } catch (error) {
    console.error("Error listing videos:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};