/**
 * Brand Studio database schema (Drizzle, Postgres on Neon).
 *
 * Owned by phase 0. Feature agents: do not edit concurrently. If you truly need a
 * change, append it at the bottom in a clearly marked block and run `npm run db:generate`.
 *
 * Column names: TS keys are camelCase, DB columns are snake_case (`casing: "snake_case"`
 * is set in both src/db/index.ts and drizzle.config.ts).
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ---------- enums ----------

export const postType = pgEnum("post_type", ["explain", "tried", "lessons"]);
export const postStatus = pgEnum("post_status", ["draft", "interview", "drafted", "posted"]);
export const platform = pgEnum("platform", ["linkedin", "x", "instagram"]);
export const uploadKind = pgEnum("upload_kind", ["image", "code"]);
export const voiceSource = pgEnum("voice_source", ["sample", "final_post"]);

export type PostType = (typeof postType.enumValues)[number];
export type PostStatus = (typeof postStatus.enumValues)[number];
export type Platform = (typeof platform.enumValues)[number];

// ---------- json column shapes ----------

/** linkedin: `text`. x: `posts` (1 item = single post, 3-6 = thread). instagram: `caption` (slides live in `slides`). */
export type DraftContent = { text?: string; posts?: string[]; caption?: string };

/** Structured diagram returned by the LLM; laid out into tldraw shapes by the diagrams feature. */
export type DiagramSpec = {
  title?: string;
  nodes: { id: string; label: string; group?: string }[];
  edges: { from: string; to: string; label?: string }[];
  groups?: { id: string; label: string }[];
};

export type SlideContent = {
  heading?: string;
  body?: string;
  code?: string;
  language?: string;
  quote?: string;
  imageUrl?: string;
};

// ---------- shared columns ----------

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const textList = () => text().array().notNull().default([]);

// ---------- profile & voice ----------

/** Single row: the owner's profile. */
export const profile = pgTable("profile", {
  id: id(),
  handle: text().notNull().default(""),
  bio: text().notNull().default(""),
  stack: textList(),
  /** Free text: the owner's projects, one per line or short paragraphs. */
  projects: text().notNull().default(""),
  topics: textList(),
  avoidTopics: textList(),
  /** Client/company names the slop check flags if they appear in any draft. */
  neverMention: textList(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const voiceExamples = pgTable("voice_examples", {
  id: id(),
  text: text().notNull(),
  source: voiceSource().notNull(),
  /** Set when source = 'final_post'. */
  postId: uuid().references(() => posts.id, { onDelete: "set null" }),
  platform: platform(),
  createdAt: createdAt(),
});

// ---------- radar ----------

export const sources = pgTable("sources", {
  id: id(),
  name: text().notNull(),
  /** Page to scrape. Null for kind 'search'. */
  url: text(),
  /** Firecrawl search query, for kind 'search'. */
  query: text(),
  kind: text({ enum: ["hn", "github_trending", "changelog", "blog", "search"] }).notNull(),
  enabled: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const radarRuns = pgTable("radar_runs", {
  id: id(),
  status: text({ enum: ["running", "done", "failed"] }).notNull().default("running"),
  error: text(),
  triggerRunId: text(),
  /** Set for on-demand topic research runs; weekly radar runs leave it null. */
  topic: text(),
  startedAt: createdAt(),
  finishedAt: timestamp({ withTimezone: true }),
});

export const radarItems = pgTable("radar_items", {
  id: id(),
  runId: uuid()
    .notNull()
    .references(() => radarRuns.id, { onDelete: "cascade" }),
  sourceId: uuid().references(() => sources.id, { onDelete: "set null" }),
  /** Unique: a URL is never suggested twice. */
  url: text().notNull().unique(),
  title: text().notNull(),
  summary: text().notNull().default(""),
  whyItMatters: text().notNull().default(""),
  suggestedType: postType().notNull(),
  score: real().notNull().default(0),
  shown: boolean().notNull().default(false),
  used: boolean().notNull().default(false),
  createdAt: createdAt(),
});

// ---------- reflections ----------

/** Reflection bank. Seeded questions have answer = null until answered. */
export const reflections = pgTable("reflections", {
  id: id(),
  question: text().notNull(),
  answer: text(),
  used: boolean().notNull().default(false),
  answeredAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- posts ----------

export const posts = pgTable("posts", {
  id: id(),
  type: postType().notNull(),
  status: postStatus().notNull().default("draft"),
  /** Monday of the posting week (Asia/Karachi), see src/lib/week.ts. */
  weekOf: date().notNull(),
  title: text().notNull().default(""),
  radarItemId: uuid().references(() => radarItems.id, { onDelete: "set null" }),
  reflectionId: uuid().references(() => reflections.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const interviewQas = pgTable(
  "interview_qas",
  {
    id: id(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    order: integer().notNull(),
    question: text().notNull(),
    answer: text(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.postId, t.order)],
);

export const uploads = pgTable("uploads", {
  id: id(),
  postId: uuid()
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  kind: uploadKind().notNull(),
  /** Vercel Blob URL (images). */
  blobUrl: text(),
  /** Pasted code (kind 'code'). */
  codeText: text(),
  /** True when the AI wrote an illustrative snippet the owner must approve. */
  isGenerated: boolean().notNull().default(false),
  /** Set when the owner approves an AI-written snippet; drafts need it when isGenerated. */
  approvedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

export const drafts = pgTable(
  "drafts",
  {
    id: id(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    platform: platform().notNull(),
    content: jsonb().$type<DraftContent>().notNull(),
    version: integer().notNull().default(1),
    isFinal: boolean().notNull().default(false),
    postedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.postId, t.platform, t.version)],
);

export const slopFlags = pgTable("slop_flags", {
  id: id(),
  draftId: uuid()
    .notNull()
    .references(() => drafts.id, { onDelete: "cascade" }),
  /** 'lint' = deterministic rules, 'llm' = model review. */
  source: text({ enum: ["lint", "llm"] }).notNull().default("lint"),
  rule: text().notNull(),
  quote: text().notNull(),
  suggestion: text().notNull().default(""),
  dismissed: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const diagrams = pgTable("diagrams", {
  id: id(),
  postId: uuid()
    .notNull()
    .unique()
    .references(() => posts.id, { onDelete: "cascade" }),
  spec: jsonb().$type<DiagramSpec>().notNull(),
  tldrawSnapshot: jsonb().$type<unknown>(),
  pngUrl: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const slides = pgTable(
  "slides",
  {
    id: id(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    order: integer().notNull(),
    kind: text({ enum: ["title", "text", "diagram", "code", "quote"] }).notNull(),
    content: jsonb().$type<SlideContent>().notNull(),
    pngUrl: text(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.postId, t.order)],
);

// ---------- relations (for db.query.*.findMany({ with: ... })) ----------

export const radarRunsRelations = relations(radarRuns, ({ many }) => ({ items: many(radarItems) }));

export const radarItemsRelations = relations(radarItems, ({ one }) => ({
  run: one(radarRuns, { fields: [radarItems.runId], references: [radarRuns.id] }),
  source: one(sources, { fields: [radarItems.sourceId], references: [sources.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  radarItem: one(radarItems, { fields: [posts.radarItemId], references: [radarItems.id] }),
  reflection: one(reflections, { fields: [posts.reflectionId], references: [reflections.id] }),
  interviewQas: many(interviewQas),
  uploads: many(uploads),
  drafts: many(drafts),
  diagram: one(diagrams),
  slides: many(slides),
}));

export const interviewQasRelations = relations(interviewQas, ({ one }) => ({
  post: one(posts, { fields: [interviewQas.postId], references: [posts.id] }),
}));

export const uploadsRelations = relations(uploads, ({ one }) => ({
  post: one(posts, { fields: [uploads.postId], references: [posts.id] }),
}));

export const draftsRelations = relations(drafts, ({ one, many }) => ({
  post: one(posts, { fields: [drafts.postId], references: [posts.id] }),
  slopFlags: many(slopFlags),
}));

export const slopFlagsRelations = relations(slopFlags, ({ one }) => ({
  draft: one(drafts, { fields: [slopFlags.draftId], references: [drafts.id] }),
}));

export const diagramsRelations = relations(diagrams, ({ one }) => ({
  post: one(posts, { fields: [diagrams.postId], references: [posts.id] }),
}));

export const slidesRelations = relations(slides, ({ one }) => ({
  post: one(posts, { fields: [slides.postId], references: [posts.id] }),
}));
