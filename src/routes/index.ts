import { Router } from "express";
import videosRouter from "./addVideo";

const router = Router();

router.use("/add-video", videosRouter);

export default router;