import { Request, Response } from "express";
import { db } from "../db";
import { questionsTable } from "../db/schema";
import { desc, eq } from "drizzle-orm";

export const listConversation = async (req: Request, res: Response) => {
  const { videoId } = req.params;

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.videoId, Number(videoId)))
    .orderBy(desc(questionsTable.askedAt));

  res.status(200).json(questions);
};
