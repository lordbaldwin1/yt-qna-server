# yt-qna-server

This backend allows users to upload YouTube video URLs, fetches and stores video metadata and transcripts, generates embeddings for transcript chunks, and enables users to ask questions about the video content using semantic search and Gemini AI.

## NOTES FOR WORK
- 

## Features
- Upload YouTube video URLs and store metadata, transcript, and summary
- Chunk and embed transcripts for semantic search
- Ask questions about a video and get AI-generated answers with relevant timestamps
- Store and retrieve Q&A history per video
- List all uploaded videos

## Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file with the required environment variables:
   - `DATABASE_URL`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`
   - `YOUTUBE_API_KEY`
   - `GEMINI_API_KEY`
4. Start the backend:
   ```bash
   npm run dev
   ```
5. Ensure your Postgres database is running with the `pgvector` extension enabled.

## Main API Endpoints

### Video Endpoints
- `POST /api/videos` — Upload a YouTube video URL. Fetches metadata, transcript, and stores embeddings.
- `GET /api/list-videos` — List all uploaded videos.

### Q&A Endpoints
- `POST /api/ask-question` — Ask a question about a video. Returns an AI-generated answer and the relevant timestamp.
- `GET /api/list-conversation/:videoId` — List all questions and answers for a specific video.

## Technologies Used
- Node.js, Express
- Drizzle ORM
- PostgreSQL with pgvector
- Gemini AI (Google GenAI)
- YouTube Data API

## License
MIT
