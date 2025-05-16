import { Router } from "express";
import { getVideo } from "../controllers/getVideoController";

const router = Router();

router.get("/:videoId", getVideo);

export default router;