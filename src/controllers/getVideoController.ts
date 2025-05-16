import { eq } from "drizzle-orm";
import { Request, Response } from "express";
import { db } from "../db";
import { videosTable } from "../db/schema";
import { ApiResponse, Video } from "../types/api";

export const getVideo = async (req: Request, res: Response) => {
  const { videoId } = req.params;
  
  const video = await db.query.videosTable.findFirst({
    where: eq(videosTable.id, parseInt(videoId)),
  });

  const videoResponse: ApiResponse<Video> = {
    message: "Video fetched successfully",
    data: video,
  };
  return res.status(200).json(videoResponse);
};

