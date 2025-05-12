import { Router } from "express";
import { addVideo } from "../controllers/addVideoController";

const router = Router();

router.post("/", addVideo);

export default router;