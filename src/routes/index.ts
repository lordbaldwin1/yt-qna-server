import { Router } from "express";
import addVideoRoute from "./add-video";
// import askQuestionRoute from "./ask-question";
import listVideosRoute from "./list-videos";
import listConversationRoute from "./list-conversation";
import getVideoRoute from "./get-video";
const router = Router();

router.use("/add-video", addVideoRoute);
// router.use("/ask-question", askQuestionRoute);
router.use("/list-videos", listVideosRoute);
router.use("/list-conversation", listConversationRoute);
router.use("/get-video", getVideoRoute);

export default router;