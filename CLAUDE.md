# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev`: start the dev server (Turbopack)
- `npm run build` / `npm run start`: production build and serve
- `npm run lint`: ESLint (flat config with `eslint-config-next` core-web-vitals and typescript presets)
- `npm run db:studio`: open Drizzle Studio
- `npm run db:push`: runs `drizzle-kit push`, but the installed drizzle-kit (0.18) can't push against drizzle-orm 0.45. Schema changes are therefore written as additive, idempotent SQL files in `lib/db/*.sql` (`ai-conversations.sql`, `calendar-events.sql`, `note-lock.sql`) and applied directly, alongside the matching edit to `lib/db/schema.ts`. There's no migrations folder.
- `npx tsx lib/ai/proposal.check.ts`: the only automated check, a focused script for AI proposal validation. There's no test framework.

`pnpm-workspace.yaml` and `node_modules/.pnpm` show the project is installed with pnpm, but both `package-lock.json` and `pnpm-lock.yaml` are checked in. Don't change either without agreement.

## Environment

`.env.local` needs `DATABASE_URL` (Neon Postgres) and `GOOGLE_GENERATIVE_AI_API_KEY` (used by `@ai-sdk/google`). `OPENAI_API_KEY` is optional: `@ai-sdk/openai` is installed but not used. `ORBIT_AI_MOCK=1` (ignored in production) swaps Gemini for a deterministic mock model in `lib/ai/mockModel.ts`, so the chat pipeline can be tested without API calls. `lib/db/index.ts` throws at import time if `DATABASE_URL` is missing.

## Stack

Next.js 16 App Router with the React Compiler enabled (`reactCompiler: true` in `next.config.ts`), React 19, Tailwind v4 (configured in `app/globals.css`, with no tailwind config file), and shadcn/ui using the `base-nova` style, built on `@base-ui/react` rather than Radix. The data layer is Drizzle ORM over the `neon-http` driver. The editor is BlockNote, and AI calls go through the Vercel AI SDK v7. The path alias is `@/*` → repo root.

## Architecture

**Components** are grouped by area: `components/ai/` (AI sidebar, chats, draft-assist notification), `components/notes/` (workspace, editor, header actions, dialogs), `components/layout/` (app shell, navigation, theme), `components/blocks/` (custom BlockNote blocks), `components/dashboard/`, `components/calendar/`, and `components/ui/` (shadcn primitives plus shared controls like `IconPicker`/`DynamicIcon`). Routes and API routes live in `app/`.

Orbit is a Notion-style notes app with an AI assistant aimed at ADHD students.

**The main app lives at `/` (`app/page.tsx`), not `/dashboard`.** It's an async Server Component that loads notes, notebooks and AI chats for a hardcoded `testUserId = "user_demo_123"` (there's no auth yet) and renders `NavShell` + `SidebarNav` plus the main area. `app/dashboard/` (with `components/layout/app-sidebar.tsx`) is a separate placeholder shell.

**State lives in the URL.** `?noteId=...` selects the note, `aiOpen=true` opens the AI panel, `view=dashboard|calendar|chats` shows a full-width view instead of the editor, and `chatId=...` (or `new`) selects an AI chat. Navigation happens through `<Link>`s that rebuild the query string. With no `noteId` the page falls back to the most recently updated note. `NoteWorkspace` stays mounted (hidden with CSS) under a `view` so the editor and its unsaved state are never torn down.

**Views:** `components/dashboard/` (customizable dashboard; layout and images in `lib/dashboard/`, config kept client-side), `components/calendar/CalendarView.tsx` (events from the `calendar_events` table plus habits read from notes via `lib/notes/habits.ts`; scheduled habits are drawn as small colored lines per date, derived on the fly with `habitsOnDate`, solid = done, hollow = not done, and link to the owning note; nothing per occurrence is stored), and `components/ai/AiChatsView.tsx` (all saved chats).

**Data mutations** are Server Actions in `lib/actions/` (`notes`, `notebooks`, `calendar`, `conversations`, `export`; all `"use server"`). They call `revalidatePath("/")` so the server-rendered page refreshes. `getNotes`/`createNote` upsert a placeholder `users` row through `ensureUserExists`, since there's no real user provisioning. Actions take ids directly and don't check ownership. A locked note (`notes.is_locked`) rejects content writes in `updateNote`.

**Schema** (`lib/db/schema.ts`): `users` (text id) → `notebooks` → `notes`, plus `ai_conversations`/`ai_messages` (max 3 chats per note) and `calendar_events`. `notes.notebookId` is nullable, and a null value means "uncategorized". `notes.content` is `jsonb` holding a BlockNote block array, and `icon` is a lucide icon name rendered via `DynamicIcon`.

**Editor flow:** `NoteWorkspace` (client) → `NoteEditor` → `BlockEditor` (all in `components/notes/`), which is loaded with `next/dynamic` and `ssr: false` because BlockNote is client-only. Every content or title change calls `updateNote` inside `startTransition`, with no debounce. `NoteEditor` is keyed by note id so switching notes remounts it. The Habit Tracker block stores `done` as habit id → completed `YYYY-MM-DD` dates (local), so every completion belongs to one exact date; its Daily/Weekly/Monthly views are display state only and read/write that same record. `BlockEditor` registers the custom blocks in `components/blocks/` (`dataTable`, `habitTracker`, `chart`, `calendar`, `clock`; shared styling in `blockStyle.tsx`) and the slash-menu entries for them.

**Moving custom blocks:** `components/blocks/moveBlockOnDrop.ts` takes over drops of a single custom block, doing insert-copy + remove-source in one transaction, and swallows the native drop. It also keeps a safety net: if a drag leaves more identical custom blocks than it started with, the surplus is removed synchronously at the end of the drop (and again shortly after). Keep this in mind before touching drag-and-drop in the editor.

**AI:**
- Model selection is `getChatModel()` in `lib/ai/model.ts` (Gemini, or the mock when `ORBIT_AI_MOCK=1`).
- `app/api/chat/route.ts` streams a reply with `streamText` as a plain text stream, which `AiSidebar` reads manually with `res.body.getReader()` instead of `useChat`. Chats and messages are persisted (`lib/ai/conversations.ts`, `lib/actions/conversations.ts`). The current note is put into the prompt with block refs (`lib/ai/translateNote.ts`). The model's only way to change a note is the `propose_edit` tool: the server validates it (`lib/ai/proposal.ts`), streams the proposal after `PROPOSAL_MARKER`, and nothing is written until the user accepts it in `AiSidebar`, which applies it through the live editor (`lib/ai/applyProposal.ts`, editor handed up via `NoteWorkspace`'s `getEditor`).
- `app/api/assess-note/route.ts` plus `components/ai/useDraftAssist.ts` / `DraftAssistNotification.tsx` watch for an idle draft and offer an improvement review, which just opens the AI panel with `IMPROVE_PROMPT`.
- `app/api/ai-edit/route.ts` (full-document rewrite via `generateText`, hardcoded to `google("gemini-3.8-flash")`) is only used by `components/ai/InlineAiWidget`, which isn't mounted anywhere, and neither are `AgentDock` or `DiffReviewModal` (same folder). They're kept pending a decision on the deferred inline-edit feature.

## Product Reference

The full Orbit product specification is located at `docs/ORBIT_PRODUCT_REFERENCE.docx`.

Consult this document when relevant to understand Orbit's product vision, design principles, planned features, and long-term architecture.

Important rules:
- Treat the existing source code as the authority on what has actually been implemented.
- Treat the product reference as the source of product goals, not proof that planned features already exist.
- Do not rewrite the existing architecture simply to match a proposed future architecture.
- Implement only the features explicitly requested by the user.
- Do not introduce AI features unless explicitly requested.
- Prefer small, maintainable changes that preserve existing functionality.
