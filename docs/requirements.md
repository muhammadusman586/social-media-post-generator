# Brand Studio: requirements and design

Date: 2026-11-13 · Owner: Muhammad Usman (single user)

## 1. Why this exists

I'm a software / AI engineer with ~2 years of experience. I want to build a personal
brand on **LinkedIn, X and Instagram** by posting **once a week** about new things in
AI and software. I don't have time to research every week, and I refuse to post
**AI slop**: generic "AI is changing everything 🚀" posts anyone could have written.

Brand Studio is a personal web app that:

1. **finds** what's new and relevant to my stack (using Firecrawl),
2. **interviews** me so the opinion and experience in each post are mine,
3. **drafts** platform-ready posts from my answers (OpenAI via the Vercel AI SDK),
4. **draws a diagram** with tldraw when a diagram helps, which I then fix by hand,
5. hands me everything in a form I can **post by hand in under a minute**, from my phone.

The core rule: **the AI never invents my opinion or experience.** It finds topics,
asks questions, and shapes my answers. Every draft must contain something only I
could have written.

## 2. Goals

- One finished, non-slop post per week across LinkedIn, X and Instagram.
- A weekly loop I can finish in ~20–30 minutes, mostly from my phone.
- Posts that sound like me, and get closer to my voice the more I edit.
- Diagrams for posts where a picture explains better than text.

## 3. Non-goals (v1)

- **No auto-posting.** I post myself. No LinkedIn/X/Instagram API integration.
- No analytics, scheduling, follower tracking or engagement features.
- No multi-user, teams or sharing. Exactly one user: me.
- No scraping LinkedIn or X (they block it and it breaks their terms).
- No AI-generated images or photos.
- No LinkedIn PDF carousels in v1 (LinkedIn multi-image posts are enough).

## 4. Anti-goals (failure even if it "works")

- A draft that claims I did, tried, felt or learned something I didn't tell it.
- A draft with no concrete proof element (number, code, screenshot, real situation).
- Posts that read like generic AI content (see slop rules in §7.6).
- An app so heavy that I stop using it after two weeks.

## 5. The three post types

I chose three types. Each has its own source, interview and outputs.

| Type | Source | Interview asks (examples) | Outputs | Required proof |
|---|---|---|---|---|
| **Explain it simply** | Radar: a concept engineers are discussing now (MCP, evals, agent memory…) | "How would you explain this to a junior?" "Where have you seen it used?" | Instagram carousel (6–7 slides) · LinkedIn post + the same slides as images · X thread | A diagram or a code snippet |
| **I tried it** | Radar: a new release/tool relevant to my stack | "What did you build/try?" "What worked?" "What broke or surprised you?" | LinkedIn story post · X post or short thread · (optional) Instagram slides | My screenshot or code snippet (upload required) |
| **2-year lessons** | My reflection bank (no news needed) | Weekly reflection prompt, e.g. "What did you get wrong this month?" | LinkedIn text post · X post · Instagram single quote-style slide | A real situation from my work (client names removed) |

**Rotation (default, editable):** week 1 Explain · week 2 I tried it · week 3 Explain ·
week 4 2-year lessons. The app suggests the week's type; I can switch.

## 6. The weekly loop

1. **Monday morning, the Radar runs** (scheduled) and saves a shortlist of 3–5 items.
   Each item shows: title, source link, one line on *why it matters to me*, and the
   suggested post type. A manual "Refresh radar" button also exists.
2. **I pick one** item (or a reflection from the bank for "2-year lessons").
3. **Interview:** the app asks 2–3 questions tailored to the item and type. I answer
   in rough words, typed or with the phone keyboard's dictation. Roman Urdu / mixed
   English is allowed; drafts come out in English. For "I tried it" I upload a
   screenshot or paste code.
4. **Drafts:** the app generates LinkedIn, X and Instagram versions from my answers.
5. **Diagram (when useful):** the app proposes a diagram, draws it on a tldraw canvas,
   and I edit it (best on laptop). Exported PNGs feed the slides and X image.
6. **Slop check:** every draft is checked; problems are listed with the exact line.
7. **I edit** drafts inline. My final versions are saved and used as voice examples.
8. **Post kit:** per platform, ready-to-post text + images with one-tap actions
   (§7.8). I mark the post as posted.

## 7. Features in detail

### 7.1 Profile & voice
- One-time setup: short bio, stack, projects, topics I care about, topics to avoid.
- Paste 3–10 samples of my own writing (old posts, messages, notes) as voice examples.
- Every time I finalize a post, the (draft → my final) pair is stored and the most
  recent few finals are used as voice examples in future generations.
- Engineers I learn from: a list of blogs/newsletters I add. The Radar can read them
  for topics. Posts I like from LinkedIn/X can be pasted in as "inspiration" and are
  used only for structure notes, never copied.

### 7.2 Radar (Firecrawl)
- Sources: a configurable list, seeded with Hacker News front page, GitHub trending,
  release notes / changelogs for my stack (Next.js, Vercel AI SDK, OpenAI, Anthropic,
  Trigger.dev, Neon, Vercel, Clerk) and Firecrawl web searches for the week's AI news.
- Runs weekly (Monday 06:00 Asia/Karachi) via Trigger.dev, plus on demand.
- An LLM ranks candidates against my profile and labels each with a post type
  (Explain / I tried it) and a one-line "why it matters to you".
- Already-shown URLs are not suggested again.

### 7.3 Interview
- Questions generated per item + post type, max 3.
- Answers are free text. Voice input = the phone keyboard's built-in dictation in v1
  (no custom audio recording).
- "I tried it" requires at least one uploaded image or a pasted code snippet before
  drafts can be generated.

### 7.4 Drafts (OpenAI via Vercel AI SDK)
- Provider: `@ai-sdk/openai`. Model ID comes from an env var (`OPENAI_MODEL`) so it
  can change without code changes. Use structured output for drafts and slides.
- Inputs: profile, voice examples, item content, interview answers, post type.
- Platform rules:
  - **LinkedIn:** 150–250 words, short paragraphs, hook in the first 2 lines, max 3 hashtags.
  - **X:** single post ≤ 280 chars, or a thread of 3–6 posts each ≤ 280 chars (counted and shown).
  - **Instagram:** caption + slides. Explain: 6–7 slides. Lessons: 1 quote-style slide.
- Drafts must only use facts from the item and my answers. If something is missing,
  the draft leaves a visible `[ADD: …]` placeholder instead of inventing it.
- Regenerate per platform, with an optional instruction ("shorter", "more blunt").

### 7.5 Diagrams (tldraw)
- For Explain (and optionally I tried it), the LLM decides whether a diagram helps and,
  if so, returns a structured diagram (nodes, edges, labels, groups).
- The app lays it out and creates tldraw shapes in code (`editor.createShape` /
  arrows bound to shapes), in tldraw's hand-drawn style.
- I edit freely on the canvas. The canvas state is saved with the post.
- Export to PNG via the tldraw editor export API, sized for slides (1080×1350) and X.
- Must verify early: whether the tldraw hobby/trial license watermark appears in
  exported images.

### 7.6 Slop check
- **Deterministic lint:** banned words and phrases from the installed `no-ai-slop`
  skill (delve, leverage, game changer, let's dive in, …), binary contrasts
  ("This is not X. It's Y."), faux-insight openers, emoji bullet lists, more than 3
  hashtags, X posts over 280 chars.
- **LLM review** against the same rules plus: "Does it contain a concrete proof
  element?" and "Does it claim anything not in the interview answers?"
- Results shown per draft as a list: rule, quoted line, suggested fix. I can fix,
  regenerate, or dismiss a flag.

### 7.7 Slides
- Rendered server-side as PNG images (1080×1350) from templates; no design tool needed.
- A few clean templates: title slide, text slide, diagram slide, code slide, quote slide.
- Visual style: simple, high contrast, my name/handle on each slide.

### 7.8 Post kit (easy manual posting)
For each platform on the finished post:
- **Copy text** button (for X threads: copy each post separately, numbered).
- **Share images** button using the Web Share API with files (opens the iOS share
  sheet → Instagram / LinkedIn / X directly). Fallback: download images.
- **Open app** link (LinkedIn / X / Instagram).
- Character counts and a "Mark as posted" toggle per platform.

### 7.9 Reflection bank (for 2-year lessons)
- A weekly reflection question appears on the home screen; answers are saved.
- When it's a lessons week, I pick a saved reflection as the post's source.

### 7.10 Home screen
- This week's suggested post type + status (not started / interview / drafts / posted).
- Radar shortlist.
- Reflection question.
- History of past posts (searchable list) so I don't repeat topics.

## 8. Constraints and decisions made

| Decision | Choice | By |
|---|---|---|
| Platform | Web app, usable on iPhone (installable to home screen via web manifest) | Me |
| Users | Personal, single user | Me |
| Publishing | Manual. App provides copy/share-ready post kits | Me |
| Post types | Explain it simply · I tried it · 2-year lessons | Me |
| Frequency | One post per week | Me |
| Diagrams | tldraw | Me |
| Research | Firecrawl (API in the app) | Me |
| AI | OpenAI models through the Vercel AI SDK ("ChatGPT AI SDK") | Me |
| Framework | Next.js (App Router) + TypeScript, deployed on Vercel | Claude's call (my usual stack) |
| Database | Neon Postgres + Drizzle ORM | Claude's call |
| Background jobs | Trigger.dev (weekly radar, long LLM calls) | Claude's call |
| Auth | Clerk, locked to my single account (owner user ID check in middleware) | Claude's call |
| UI | Tailwind + shadcn/ui, mobile-first | Claude's call |
| File uploads | Vercel Blob (screenshots, exported images) | Claude's call |
| Slide rendering | Server-side PNG via `next/og` ImageResponse | Claude's call |
| Voice input | Phone keyboard dictation (no custom audio in v1) | Claude's call |

**Licenses / accounts I need:** OpenAI API key, Firecrawl API key, Neon database,
Clerk app, Trigger.dev project, Vercel project (+ Blob store), tldraw license key
(Hobby: free, non-commercial, reviewed by tldraw, watermark on canvas; or a 100-day
Trial meanwhile). The app must run locally in development with no tldraw key.

**Privacy:** client names must never appear in drafts unless I type them. API keys
stay server-side. All app routes require my login.

## 9. Left to the builder

- Database schema details, route structure, component breakdown.
- Diagram auto-layout approach (simple layered layout is fine).
- Exact prompts, as long as they follow §7.4 and §7.6.
- Slide template visual design within §7.7.
- Testing approach: unit tests for the slop linter, X character splitting and diagram
  layout; a smoke test for the main flow with LLM and Firecrawl calls mocked.

## 10. Done means

- I can log in on my iPhone, see the Radar shortlist, pick an item, answer the
  interview, get LinkedIn/X/Instagram drafts with slides and (when useful) an editable
  tldraw diagram, see slop flags, edit, and copy/share everything to post by hand.
- The weekly Radar runs on schedule without me.
- The app works end to end for all three post types.
