import express, { Request, Response } from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";

import dotenv from "dotenv";
import routes from "./routes";
import { handleAskQuestionWS } from "./controllers/askQuestionController";
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use("/api", routes);
app.use(
  cors({
    origin: `${process.env.FRONTEND_URL}`,
  })
);

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.send(JSON.stringify({ type: "connection", message: "Welcome to the server" }));

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log("Received message:", parsedMessage);

      // Handle different message types
      switch (parsedMessage.type) {
        case "ask_question":
          handleAskQuestionWS(ws, parsedMessage);
          break;
        default:
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Unknown message type" 
          }));
      }
    } catch (error) {
      console.error("Error parsing message:", error);
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`WebSocket server is running on ws://localhost:${port}`);
});
