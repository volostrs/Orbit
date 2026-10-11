# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev`: start the dev server (Turbopack)
- `npm run build` / `npm run start`: production build and serve
- `npm run lint`: ESLint (flat config with `eslint-config-next` core-web-vitals and typescript presets)
- `npm run db:push`: push `lib/db/schema.ts` straight to the database with drizzle-kit. There's no migrations folder, so schema changes go through `push`.
- `npm run db:studio`: open Drizzle Studio

There's no test framework set up yet. Both `package-lock.json` and `pnpm-lock.yaml` are checked in.

## Environment

`.env.local` needs `DATABASE_URL` (Neon Postgres), `GOOGLE_GENERATIVE_AI_API_KEY` (used by `@ai-sdk/google`), and `OPENAI_API_KEY` (`@ai-sdk/openai` is installed but not used yet). `lib/db/index.ts` throws at import time if `DATABASE_URL` is missing.

## Stack

Next.js 16 App Router with the React Compiler enabled (`reactCompiler: true` in `next.config.ts`), React 19, Tailwind v4 (configured in `app/globals.css`, with no tailwind config file), and shadcn/ui using the `base-nova` style, built on `@base-ui/react` rather than Radix. The data layer is Drizzle ORM over the `neon-http` driver. The editor is BlockNote, and AI calls go through the Vercel AI SDK v7. The path alias is `@/*` → repo root.

## Architecture

Orbit is a Notion-style notes app with an AI assistant aimed at ADHD students.

**The main app lives at `/` (`app/page.tsx`), not `/dashboard`.** It's an async Server Component that loads notes and notebooks for a hardcoded `testUserId = "user_demo_123"` (there's no auth yet) and renders the left sidebar directly. `app/dashboard/` (with `components/app-sidebar.tsx`) is a separate placeholder shell. The `hero-*`/`cta-section` components are landing-page pieces and aren't currently routed.

**State lives in the URL.** The selected note and the AI panel's open state are `?noteId=...&aiOpen=true` search params, and navigation happens through `<Link>`s that rebuild the query string. If no `noteId` is given, the page falls back to the most recently updated note.

**Data mutations** are Server Actions in `lib/actions/` (`"use server"`). Every action calls `revalidatePath("/")` so the server-rendered sidebar refreshes. `getNotes`/`createNote` upsert a placeholder `users` row through `ensureUserExists`, since there's no real user provisioning. Actions take ids directly and don't check ownership. `lib/db/queries.ts` is empty.

**Schema** (`lib/db/schema.ts`): `users` (text id) → `notebooks` → `notes`. `notes.notebookId` is nullable, and a null value means "uncategorized". `notes.content` is `jsonb` holding a BlockNote block array, and `icon` is a lucide icon name rendered via `DynamicIcon`.

**Editor flow:** `NoteWorkspace` (client) → `NoteEditor` → `BlockEditor`, which is loaded with `next/dynamic` and `ssr: false` because BlockNote is client-only. Every content or title change calls `updateNote` inside `startTransition`, with no debounce. `NoteEditor` is keyed by note id so switching notes remounts it.

**AI:**
- `app/api/chat/route.ts` uses `streamText` and returns `toTextStreamResponse()`, which is a plain text stream, not the AI SDK UI message protocol. `AiSidebar` reads it manually with `res.body.getReader()` instead of `useChat`. Chat history is client state keyed by note id and isn't persisted. The current note's content goes into the system prompt.
- `app/api/ai-edit/route.ts` uses `generateText` to return a full rewritten document. `NoteWorkspace` has `proposedContent` state wired to `DiffReviewModal` for accept/reject, but nothing calls `setProposedContent` yet. `InlineAiWidget` calls `/api/ai-edit` but isn't mounted anywhere, and neither is `AgentDock`.
- Both routes use `google("gemini-3.8-flash")` and share the "Orbit AI" system persona.
