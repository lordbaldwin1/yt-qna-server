import { Router } from "express";
import { listVideos } from "../controllers/listVideosController";

const router = Router();

router.get("/", listVideos);

export default router;