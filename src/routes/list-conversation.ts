import { Router } from "express";
import { listConversation } from "../controllers/listConversation";

const router = Router();

router.get("/:videoId", listConversation);

export default router;
