# Orbit

Orbit is a note-taking and organization app designed to help students with ADHD manage their schoolwork.

## Screenshot

## Orbit application screenshot
![alt text](image.png)
## Features

- Note-taking with BlockNote
- Organized workspaces
- Tables and charts
- Habit tracking
- AI-assisted support

## Technologies

- React
- JavaScript
- Node.js
- Tailwind CSS
- BlockNote
- PostgreSQL
- Neon

## Installation

1. Clone the repository.
2. Install dependencies with `npm install` (this project uses npm; there is only a `package-lock.json`).
3. Configure the required environment variables.
4. Start the development server.

## Environment variables

Set these in `.env.local` for local development, and in your host's settings (for example Vercel → Project Settings → Environment Variables) for a deployment. Never prefix them with `NEXT_PUBLIC_` and never commit them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon Postgres connection string. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini API key. Only used by server routes. |
| `UPSTASH_REDIS_REST_URL` | Production | Upstash Redis REST URL, used for AI rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Upstash Redis REST token. |
| `ORBIT_AI_MOCK` | No | `1` swaps Gemini for a mock model in development. Ignored in production. |

In production the AI routes refuse requests (HTTP 503) if the Upstash variables are missing. Locally they are optional and rate limiting is skipped. Vercel's Upstash integration may provide `KV_REST_API_URL` and `KV_REST_API_TOKEN` instead; those are accepted too.

## Public deployment notes

- Each browser gets an anonymous, random visitor id (HttpOnly cookie, set in `proxy.ts`), and every server action and API route only touches that visitor's notes. Clearing cookies starts a fresh, empty workspace.
- `/api/ai-edit` is disabled in production.
- AI requests are limited per visitor (per minute and per day) and globally per day; see `lib/ratelimit.ts`.