import { integer, pgTable, varchar, timestamp, text, vector, doublePrecision, index } from "drizzle-orm/pg-core";


export const videosTable = pgTable("videos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  youtubeVideoId: varchar({ length: 255 }).notNull(),
  thumbnailUrl: varchar({ length: 255 }).notNull(),
  title: varchar({ length: 255 }).notNull(),
  description: text().notNull(),
  url: text().notNull(),
  embedUrl: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transcriptChunksTable = pgTable("transcript_chunks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer().references(() => videosTable.id),
  text: text().notNull(),
  startTime: doublePrecision(),
  endTime: doublePrecision(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("embeddingIndex").using("hnsw", t.embedding.op("vector_cosine_ops"))
]);

export const questionsTable = pgTable("questions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  question: text().notNull(),
  answer: text().notNull(),
  videoId: integer().references(() => videosTable.id),
  mostRelevantTimestamp: doublePrecision(),
  askedAt: timestamp("asked_at").defaultNow().notNull(),
  answerEmbedding: vector("answer_embedding", { dimensions: 768 }),
}, (t) => [
  index("answerEmbeddingIndex").using("hnsw", t.answerEmbedding.op("vector_cosine_ops"))
]);
