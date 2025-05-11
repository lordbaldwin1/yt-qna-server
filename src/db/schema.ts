import { integer, pgTable, varchar, timestamp, text } from "drizzle-orm/pg-core";

export const videosTable = pgTable("videos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  youtubeVideoId: varchar({ length: 255 }).notNull(),
  thumbnailUrl: varchar({ length: 255 }).notNull(),
  title: varchar({ length: 255 }).notNull(),
  description: text().notNull(),
  url: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
