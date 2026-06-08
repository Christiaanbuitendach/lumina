# Lumina

**A premium personal daily dashboard for habits and AI-powered insights.**

Built with Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Recharts, and Framer Motion. Beautiful dark theme with elegant navy + teal accents. Feels like a real product — Notion + Linear vibes.

![Lumina hero](https://github.com/user-attachments/assets/placeholder)

## Features

- **Dashboard Overview** — Clean greeting, today's date, and live stats (longest streak, today's %, weekly rate)
- **Habits** — Add habits with emoji, beautiful large toggles, live streak + last-7-day mini visualizations. Completing a habit instantly updates everything.
- **Quick Capture** — "Win of the day" textarea that auto-saves and is fed to the AI.
- **Visualizations** — Weekly completion bar chart + 30-day consistency heatmap-style dots.
- **AI Insights** — One-click analysis powered by Grok (xAI). Personalized observations + 2–3 smart recommendations based on *your actual data*.
- **Fully local** — Everything persisted in localStorage. Works instantly, zero backend required.
- **Settings** — Manage habits, export/import JSON, load demo data, clear all.
- **Premium polish** — Smooth micro-interactions, empty states, toasts, fully responsive, keyboard friendly.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Enable AI Insights (Grok / xAI)

By default the app shows high-quality fallback insights so you can use everything immediately.

### To get live personalized Grok analysis:

1. Get an API key → [https://console.x.ai/](https://console.x.ai/)
2. Create `.env.local` in the project root:
   ```env
   XAI_API_KEY=your_xai_api_key_here
   ```
3. Restart the dev server.

### Deploying to Vercel (recommended)

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. In **Project Settings → Environment Variables**, add:
   - `XAI_API_KEY` = your key (set for Production + Preview)
4. Redeploy.

You can also use the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) if you prefer to proxy calls.

The API route lives at `app/api/insights/route.ts` — fully commented.

## Data Portability

- **Export**: Settings → Export JSON (timestamped)
- **Import**: Drop any previous export back in
- Everything is just JSON. You own your data.

## Tech Stack

- Next.js 15 + Turbopack
- TypeScript
- Tailwind CSS 4 + shadcn/ui (base-nova)
- Framer Motion
- Recharts
- date-fns
- Sonner (toasts)
- Lucide icons

## Project Structure (key files)

```
app/
├── api/insights/route.ts     # Grok proxy (secure server route)
├── globals.css               # Premium navy + teal theme + polish
├── layout.tsx                # Dark-forced, Toaster + TooltipProvider
└── page.tsx                  # The entire delightful app (SPA-style)

components/ui/                # All shadcn components
lib/utils.ts
```

## Development Tips

- All state is in `app/page.tsx` (kept simple and self-contained for v1).
- Pure functions for streaks and rates live at the top of the page.
- Adding a habit, toggling, or editing the daily note instantly recomputes stats and charts via React state + useMemo.
- The AI panel clears previous insights on meaningful data changes (encourages fresh analysis).

## Deploy

The project is 100% ready for Vercel one-click deploy (after adding the optional `XAI_API_KEY`).

Because everything is client + a single tiny server route, it is extremely cheap to host.

---

Built to feel calm, premium, and immediately useful. Enjoy building your streaks.

— Lumina
