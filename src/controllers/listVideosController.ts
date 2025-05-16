import { Request, Response } from "express";
import { db } from "../db";
import { videosTable } from "../db/schema";
import { ApiResponse, Video } from "../types/api";

export const listVideos = async (req: Request, res: Response) => {
  try {
    const videos = await db.select().from(videosTable);
    const response: ApiResponse<Video[]> = {
      message: "Videos fetched successfully",
      data: videos
    };
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error listing videos:", error);
    const errorResponse: ApiResponse<null> = {
      message: "Internal server error"
    };
    return res.status(500).json(errorResponse);
  }
};