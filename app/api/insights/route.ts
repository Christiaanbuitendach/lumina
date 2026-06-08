import { NextRequest, NextResponse } from "next/server";

/**
 * Lumina AI Insights — Grok / xAI Integration
 *
 * This route securely calls the xAI API from the server so your API key
 * is never exposed to the browser.
 *
 * HOW TO ENABLE REAL AI INSIGHTS:
 * --------------------------------
 * 1. Get an API key at https://console.x.ai/
 * 2. Local development:
 *      - Create a file called `.env.local` in the project root
 *      - Add:  XAI_API_KEY=your_key_here
 * 3. Vercel deployment:
 *      - Go to your project on Vercel → Settings → Environment Variables
 *      - Add: XAI_API_KEY = your_key_here  (Production + Preview)
 * 4. (Optional) You can also use Vercel AI Gateway if you prefer proxying.
 *
 * The route gracefully falls back in the frontend if no key or on error.
 *
 * Model: We use "grok-3" (or "grok-3-mini" for faster/cheaper responses).
 * You can change the model below easily.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      habits = [],
      weekData = [],
      todayNote = "",
      recentNotes = [],
      longestStreak = 0,
      weeklyRate = 0,
    } = body as {
      habits?: Array<{ id: string; name: string; emoji: string }>;
      weekData?: Array<{ date: string; rate: number; completed: number; total?: number }>;
      todayNote?: string;
      recentNotes?: Array<{ date: string; note: string }>;
      longestStreak?: number;
      weeklyRate?: number;
    };

    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "XAI_API_KEY is not set. Add it to .env.local or your Vercel environment variables to enable live Grok insights.",
        },
        { status: 401 }
      );
    }

    // Build a rich, concise prompt for Grok
    const systemPrompt = `You are Lumina, an elegant, insightful, and encouraging habit coach.
Your tone is warm, premium, and direct — like a thoughtful friend who has studied the user's data deeply.
You speak in short, beautiful paragraphs. You celebrate progress without being cheesy.
Never moralize. Focus on patterns, leverage points, and tiny high-leverage actions.

Output format (use markdown):
**Observations**
- 2-3 specific, data-grounded observations

**Recommendations**
- 2-3 concrete, actionable recommendations (use the user's actual habit names when possible)

Keep the entire response under 200 words.`;

    const userPrompt = `Here is the user's recent habit data:

Habits being tracked:
${habits.map((h: { emoji: string; name: string }) => `- ${h.emoji} ${h.name}`).join("\n")}

Last 7 days performance:
${weekData
  .map(
    (d: { date: string; rate: number; completed: number; total?: number }) =>
      `${d.date}: ${d.rate}% (${d.completed}/${d.total || habits.length} completed)`
  )
  .join("\n")}

Current longest streak: ${longestStreak} days
Weekly completion average: ${weeklyRate}%

Today's Win / note:
${todayNote ? `"${todayNote}"` : "(none recorded)"}

${
  recentNotes.length > 0
    ? `Recent notes from the week:\n${recentNotes
        .map((n: { date: string; note: string }) => `- ${n.date}: ${n.note}`)
        .join("\n")}`
    : ""
}

Analyze this data and give personalized observations + recommendations. Reference specific habits and days where relevant.`;

    // Call xAI Grok API
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3", // Change to "grok-3-mini" for lower latency / cost if desired
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("xAI API error:", errText);
      return NextResponse.json(
        { error: "Grok API request failed. Check your key and try again." },
        { status: 502 }
      );
    }

    const result = await response.json();
    const insights =
      result.choices?.[0]?.message?.content?.trim() ||
      "I couldn't generate insights this time. Please try again in a moment.";

    return NextResponse.json({ insights });
  } catch (error: unknown) {
    console.error("Insights route error:", error);
    return NextResponse.json(
      { error: "Unexpected error generating insights." },
      { status: 500 }
    );
  }
}
