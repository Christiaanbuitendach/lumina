"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Plus,
  Settings,
  Sparkles,
  Flame,
  Calendar,
  TrendingUp,
  Download,
  Upload,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// ============================================
// TYPES
// ============================================
interface Habit {
  id: string;
  name: string;
  emoji: string;
  createdAt: string; // ISO
}

type Completions = Record<string, string[]>; // "YYYY-MM-DD" -> habit ids completed
type DailyNotes = Record<string, string>;

interface AppData {
  habits: Habit[];
  completions: Completions;
  dailyNotes: DailyNotes;
}

interface WeeklyDataPoint {
  day: string;
  rate: number;
  date: string;
}

interface DayConsistency {
  date: string;
  label: string;
  rate: number;
  count: number;
  total: number;
}

// ============================================
// DATE HELPERS
// ============================================
function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function getDateNDaysAgo(n: number): string {
  return format(subDays(new Date(), n), "yyyy-MM-dd");
}

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => getDateNDaysAgo(n - 1 - i));
}

function formatDisplayDate(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, "EEEE, MMMM d");
}

function getShortDay(dateStr: string): string {
  return format(parseISO(dateStr), "EEE");
}

function getMonthDay(dateStr: string): string {
  return format(parseISO(dateStr), "MMM d");
}

// ============================================
// HABIT & STREAK LOGIC (pure)
// ============================================
function computeCurrentStreak(
  habitId: string,
  completions: Completions,
  startDate: string = getToday()
): number {
  let streak = 0;
  let current = startDate;

  // Walk backwards up to 400 days for safety
  for (let i = 0; i < 400; i++) {
    const completed = completions[current]?.includes(habitId) ?? false;
    if (!completed) break;
    streak++;
    current = getDateNDaysAgo(i + 1); // next previous day
  }
  return streak;
}

function getCompletionStatsForDate(
  date: string,
  habits: Habit[],
  completions: Completions
): { completed: number; total: number; rate: number } {
  const completedIds = completions[date] || [];
  // Only count habits that existed on or before this date
  const activeHabits = habits.filter((h) => h.createdAt <= date + "T00:00:00.000Z");
  const total = activeHabits.length || habits.length; // fallback to current if very old data
  const completed = completedIds.filter((id) =>
    activeHabits.some((h) => h.id === id)
  ).length;

  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, rate };
}

function getLast7DaysData(
  habits: Habit[],
  completions: Completions
): WeeklyDataPoint[] {
  const days = getLastNDays(7);
  return days.map((date) => {
    const { rate } = getCompletionStatsForDate(date, habits, completions);
    return {
      day: getShortDay(date),
      rate,
      date,
    };
  });
}

function get30DayConsistency(
  habits: Habit[],
  completions: Completions
): DayConsistency[] {
  const days = getLastNDays(30);
  return days.map((date) => {
    const { completed, total, rate } = getCompletionStatsForDate(
      date,
      habits,
      completions
    );
    return {
      date,
      label: getMonthDay(date),
      rate,
      count: completed,
      total,
    };
  });
}

// ============================================
// STORAGE
// ============================================
const STORAGE_KEY = "lumina-data-v1";

function loadData(): AppData {
  if (typeof window === "undefined") {
    return { habits: [], completions: {}, dailyNotes: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Basic migration / shape guard
      return {
        habits: parsed.habits || [],
        completions: parsed.completions || {},
        dailyNotes: parsed.dailyNotes || {},
      };
    }
  } catch (e) {
    console.error("Failed to load Lumina data", e);
  }
  return { habits: [], completions: {}, dailyNotes: {} };
}

function saveData(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save Lumina data", e);
  }
}

// Demo seed (beautiful first-run experience)
function createDemoData(): AppData {
  const today = getToday();
  const demoHabits: Habit[] = [
    { id: "h1", name: "Drink 8 glasses of water", emoji: "💧", createdAt: getDateNDaysAgo(18) },
    { id: "h2", name: "Morning movement", emoji: "🏃", createdAt: getDateNDaysAgo(22) },
    { id: "h3", name: "10 minutes journaling", emoji: "📓", createdAt: getDateNDaysAgo(14) },
    { id: "h4", name: "No screens after 10pm", emoji: "🌙", createdAt: getDateNDaysAgo(9) },
  ];

  const completions: Completions = {};
  const baseDays = getLastNDays(12);

  // Realistic-ish completion pattern
  baseDays.forEach((d, idx) => {
    const done: string[] = [];
    if (idx % 2 === 0 || idx > 8) done.push("h1");
    if (idx % 3 !== 0) done.push("h2");
    if (idx > 2 && idx % 2 === 1) done.push("h3");
    if (idx % 4 === 0 || idx > 7) done.push("h4");
    if (done.length) completions[d] = done;
  });

  // Make today pretty complete
  completions[today] = ["h1", "h2", "h3"];

  const dailyNotes: DailyNotes = {
    [getDateNDaysAgo(1)]: "Finally hit 10k steps without forcing it. Felt natural.",
    [today]: "Crushed the deep work block. Proud of staying off socials all morning.",
  };

  return { habits: demoHabits, completions, dailyNotes };
}

// ============================================
// MAIN APP
// ============================================
export default function Lumina() {
  const [data, setData] = useState<AppData>({ habits: [], completions: {}, dailyNotes: {} });
  const [isLoaded, setIsLoaded] = useState(false);
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);

  // Add habit dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmoji, setNewEmoji] = useState("🌱");
  const [newName, setNewName] = useState("");

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteHabitId, setIsDeleteHabitId] = useState<string | null>(null);

  // AI
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Quick capture (today's win)
  const today = getToday();
  const [dailyNote, setDailyNote] = useState("");

  // Derived data
  const habits = data.habits;
  const completions = data.completions;
  const dailyNotes = data.dailyNotes;

  const todayCompletions = completions[today] || [];
  const todayProgress = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.round((todayCompletions.length / habits.length) * 100);
  }, [habits.length, todayCompletions.length]);

  const longestStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.max(
      ...habits.map((h) => computeCurrentStreak(h.id, completions))
    );
  }, [habits, completions]);

  const weeklyRate = useMemo(() => {
    const last7 = getLastNDays(7);
    if (last7.length === 0 || habits.length === 0) return 0;
    const rates = last7.map(
      (d) => getCompletionStatsForDate(d, habits, completions).rate
    );
    const sum = rates.reduce((a, b) => a + b, 0);
    return Math.round(sum / rates.length);
  }, [habits, completions]);

  const weeklyChartData = useMemo(
    () => getLast7DaysData(habits, completions),
    [habits, completions]
  );

  const consistency30 = useMemo(
    () => get30DayConsistency(habits, completions),
    [habits, completions]
  );

  // const currentNote = dailyNotes[today] || ""; // available if needed for future UI

  // Load from localStorage
  useEffect(() => {
    const loaded = loadData();
    if (loaded.habits.length === 0) {
      // First time — offer beautiful demo or clean start
      setData({ habits: [], completions: {}, dailyNotes: {} });
      setShowDemoPrompt(true);
    } else {
      setData(loaded);
      setDailyNote(loaded.dailyNotes[today] || "");
    }
    setIsLoaded(true);
  }, [today]);

  // Persist whenever data changes
  useEffect(() => {
    if (isLoaded) {
      saveData(data);
    }
  }, [data, isLoaded]);

  // Sync note when day or data changes
  useEffect(() => {
    setDailyNote(dailyNotes[today] || "");
  }, [today, dailyNotes]);

  // Save note (auto)
  const updateDailyNote = useCallback(
    (note: string) => {
      setDailyNote(note);
      setData((prev) => ({
        ...prev,
        dailyNotes: {
          ...prev.dailyNotes,
          [today]: note.trim(),
        },
      }));
    },
    [today]
  );

  // ============================================
  // HABIT ACTIONS (live updates everywhere)
  // ============================================
  const toggleHabit = (habitId: string) => {
    const wasCompleted = todayCompletions.includes(habitId);

    setData((prev) => {
      const dayList = prev.completions[today] || [];
      const newDayList = wasCompleted
        ? dayList.filter((id) => id !== habitId)
        : [...dayList, habitId];

      const newCompletions = {
        ...prev.completions,
        [today]: newDayList,
      };

      // Nice toast feedback
      const habit = prev.habits.find((h) => h.id === habitId);
      if (!wasCompleted && habit) {
        const newStreak = computeCurrentStreak(habitId, newCompletions);
        if (newStreak > 0 && newStreak % 5 === 0) {
          toast.success(`🔥 ${newStreak}-day streak! Incredible.`, {
            description: habit.name,
          });
        } else {
          toast.success("Habit completed", { description: habit.name });
        }
      }

      return {
        ...prev,
        completions: newCompletions,
      };
    });

    // Clear previous AI insights when behavior changes (encourages fresh analysis)
    if (insights) setInsights(null);
  };

  const addHabit = () => {
    const name = newName.trim();
    if (!name) return;

    const emoji = newEmoji.trim() || "🌱";

    const newHabit: Habit = {
      id: `h_${Date.now()}`,
      name,
      emoji,
      createdAt: new Date().toISOString(),
    };

    setData((prev) => ({
      ...prev,
      habits: [...prev.habits, newHabit],
    }));

    setNewName("");
    setNewEmoji("🌱");
    setIsAddOpen(false);

    toast.success("Habit created", {
      description: `${emoji} ${name}`,
    });
  };

  const deleteHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    setData((prev) => {
      const newHabits = prev.habits.filter((h) => h.id !== habitId);

      // Clean up completions
      const newCompletions: Completions = {};
      Object.entries(prev.completions).forEach(([date, ids]) => {
        const filtered = ids.filter((id) => id !== habitId);
        if (filtered.length > 0) newCompletions[date] = filtered;
      });

      return {
        habits: newHabits,
        completions: newCompletions,
        dailyNotes: prev.dailyNotes,
      };
    });

    setIsDeleteHabitId(null);
    if (insights) setInsights(null);

    toast.error("Habit removed", {
      description: habit?.name,
    });
  };

  // Quick suggestions (empty state delight)
  const suggestions = [
    { emoji: "💧", name: "Drink 8 glasses of water" },
    { emoji: "🏃", name: "Morning movement" },
    { emoji: "📖", name: "Read 20 pages" },
    { emoji: "🧘", name: "10 min meditation" },
    { emoji: "🥗", name: "Eat a healthy meal" },
  ];

  const addSuggestion = (s: { emoji: string; name: string }) => {
    const exists = habits.some(
      (h) => h.name.toLowerCase() === s.name.toLowerCase()
    );
    if (exists) {
      toast.info("Already tracking that one");
      return;
    }
    const newHabit: Habit = {
      id: `h_${Date.now()}`,
      name: s.name,
      emoji: s.emoji,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, habits: [...prev.habits, newHabit] }));
    toast.success("Added", { description: `${s.emoji} ${s.name}` });
  };

  // ============================================
  // DEMO DATA
  // ============================================
  const loadDemoData = () => {
    const demo = createDemoData();
    setData(demo);
    setDailyNote(demo.dailyNotes[today] || "");
    setInsights(null);
    setShowDemoPrompt(false);
    setIsSettingsOpen(false);
    toast.success("Demo data loaded", {
      description: "Explore the dashboard — all data is saved locally.",
    });
  };

  const clearAllData = () => {
    const empty: AppData = { habits: [], completions: {}, dailyNotes: {} };
    setData(empty);
    setDailyNote("");
    setInsights(null);
    setIsSettingsOpen(false);
    toast("All data cleared", { description: "Fresh start." });
  };

  // ============================================
  // EXPORT / IMPORT
  // ============================================
  const exportData = () => {
    const exportObj = {
      ...data,
      exportedAt: new Date().toISOString(),
      app: "Lumina",
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumina-export-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Exported", { description: "Your data is safe." });
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (!imported.habits || !Array.isArray(imported.habits)) {
          throw new Error("Invalid file shape");
        }
        const cleanData: AppData = {
          habits: imported.habits,
          completions: imported.completions || {},
          dailyNotes: imported.dailyNotes || {},
        };
        setData(cleanData);
        setDailyNote(cleanData.dailyNotes[today] || "");
        setInsights(null);
        setIsSettingsOpen(false);
        toast.success("Import successful", {
          description: `${cleanData.habits.length} habits restored.`,
        });
      } catch {
        toast.error("Import failed", {
          description: "The file doesn't look like a valid Lumina export.",
        });
      }
    };
    reader.readAsText(file);
    // reset input
    event.target.value = "";
  };

  // ============================================
  // AI INSIGHTS (Grok / xAI)
  // ============================================
  async function generateAIInsights() {
    if (habits.length === 0) {
      toast.error("Add a few habits first");
      return;
    }

    setIsGenerating(true);
    setInsights(null);

    const last7Dates = getLastNDays(7);
    const weekData = last7Dates.map((date) => ({
      date,
      ...getCompletionStatsForDate(date, habits, completions),
    }));

    const recentNotes = last7Dates
      .map((d) => ({ date: d, note: dailyNotes[d] }))
      .filter((n) => n.note && n.note.length > 3);

    const payload = {
      habits: habits.map((h) => ({ id: h.id, name: h.name, emoji: h.emoji })),
      weekData,
      todayNote: dailyNotes[today] || "",
      recentNotes,
      longestStreak,
      weeklyRate,
    };

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        // Surface helpful message from the route
        throw new Error(json.error || "Failed to generate insights");
      }

      setInsights(json.insights);
      toast.success("Insights ready", {
        description: "Personalized by Grok",
      });
    } catch (error: unknown) {
      console.error(error);
      // Friendly fallback so the experience never breaks
      const fallback = createFallbackInsights(payload);
      setInsights(fallback);
      toast.info("Showing demo insights", {
        description:
          "Add your XAI_API_KEY to enable live Grok analysis. See README.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function createFallbackInsights(payload: {
    habits: Array<{ name: string }>;
    weekData: Array<{ rate: number }>;
    todayNote: string;
    weeklyRate: number;
    longestStreak: number;
  }): string {
    const { habits, weekData, todayNote, weeklyRate, longestStreak } = payload;
    const topHabit = habits[0]?.name || "your habits";
    const strongDays = weekData.filter((d) => d.rate >= 75).length;

    return `**Observations**
• You maintained solid momentum — ${strongDays} strong days out of the last 7.
• ${topHabit} appears to be one of your most consistent anchors.
• Your current longest streak of **${longestStreak} days** shows real commitment.

**Recommendations**
• Protect your highest-energy window for the habit that moves the needle most (often the first one you do).
• Add a tiny "if-then" rule for your lowest completion day of the week.
• Celebrate the weekly rate of ${weeklyRate}% — consider a small non-food reward on Sunday.

${todayNote ? `_Your win today was noted. Beautiful work._` : ""}`;
  }

  // ============================================
  // RENDER HELPERS
  // ============================================
  const HabitCard = ({ habit }: { habit: Habit }) => {
    const isCompleted = todayCompletions.includes(habit.id);
    const streak = computeCurrentStreak(habit.id, completions);
    const last7 = getLastNDays(7).map((d) => ({
      date: d,
      done: completions[d]?.includes(habit.id) ?? false,
    }));

    return (
      <motion.div
        layout
        whileHover={{ y: -1 }}
        className="lumina-card group flex flex-col rounded-2xl p-5 transition-all"
      >
        <div className="flex items-start gap-4">
          {/* Large satisfying toggle */}
          <button
            onClick={() => toggleHabit(habit.id)}
            className={`habit-toggle ${isCompleted ? "completed" : ""}`}
            aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
          >
            <motion.div
              animate={{ scale: isCompleted ? 1 : 0.6, opacity: isCompleted ? 1 : 0.3 }}
              transition={{ type: "spring", bounce: 0.4, duration: 0.4 }}
            >
              <Check className="h-7 w-7" strokeWidth={3.5} />
            </motion.div>
          </button>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{habit.emoji}</span>
                <div className="font-medium text-[15px] leading-tight tracking-[-0.1px] pr-1">
                  {habit.name}
                </div>
              </div>

              {streak > 0 && (
                <div className="streak-badge mt-0.5 shrink-0">
                  <Flame className="h-3 w-3 text-primary" />
                  <span>{streak}</span>
                </div>
              )}
            </div>

            {/* 7-day mini visual */}
            <div className="mt-4 flex items-center gap-1.5">
              {last7.map((d, idx) => (
                <div
                  key={idx}
                  className={`mini-day ${d.done ? "completed" : ""}`}
                  title={`${getShortDay(d.date)} — ${d.done ? "Done" : "Missed"}`}
                />
              ))}
              <span className="ml-2 text-[10px] text-muted-foreground/70 tracking-[0.5px] font-medium">
                LAST 7
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm tracking-[2px]">LUMINA</div>
      </div>
    );
  }

  const hasHabits = habits.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-semibold tracking-[-0.4px] text-xl">Lumina</div>
              <div className="text-[10px] text-muted-foreground -mt-1">DAILY RITUALS</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            <Button
              onClick={() => setIsAddOpen(true)}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New habit
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-6">
        {/* HERO / GREETING */}
        <div className="mb-9">
          <div className="text-sm uppercase tracking-[3px] text-primary/70 font-medium mb-1.5">
            {format(new Date(), "EEEE")}
          </div>
          <h1 className="text-5xl font-semibold tracking-[-1.6px] sm:text-6xl">
            Good morning.
          </h1>
          <p className="mt-2 text-xl text-muted-foreground tracking-[-0.2px]">
            {formatDisplayDate(today)}
          </p>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-10">
          <div className="stat-card rounded-2xl border p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Flame className="h-4 w-4" /> CURRENT LONGEST
            </div>
            <div className="flex items-baseline gap-1">
              <span className="stat-value text-6xl font-semibold tabular-nums tracking-[-2.5px]">
                {longestStreak}
              </span>
              <span className="text-2xl text-muted-foreground">days</span>
            </div>
          </div>

          <div className="stat-card rounded-2xl border p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Check className="h-4 w-4" /> TODAY&apos;S PROGRESS
            </div>
            <div className="flex items-baseline gap-2">
              <span className="stat-value text-6xl font-semibold tabular-nums tracking-[-2.5px]">
                {todayProgress}
              </span>
              <span className="text-3xl text-muted-foreground">%</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {todayCompletions.length} of {habits.length} habits
            </div>
          </div>

          <div className="stat-card rounded-2xl border p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <TrendingUp className="h-4 w-4" /> WEEKLY AVERAGE
            </div>
            <div className="flex items-baseline gap-2">
              <span className="stat-value text-6xl font-semibold tabular-nums tracking-[-2.5px]">
                {weeklyRate}
              </span>
              <span className="text-3xl text-muted-foreground">%</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Last 7 days completion
            </div>
          </div>
        </div>

        {/* QUICK CAPTURE — WIN OF THE DAY */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Calendar className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium tracking-[1px] text-muted-foreground">
              WIN OF THE DAY
            </div>
          </div>
          <Textarea
            value={dailyNote}
            onChange={(e) => updateDailyNote(e.target.value)}
            placeholder="What went well today? A small win, a moment of clarity, something you're grateful for..."
            className="win-textarea text-base"
          />
          <div className="mt-1.5 px-1 text-[11px] text-muted-foreground/60">
            Auto-saved • Visible to AI insights
          </div>
        </div>

        {/* HABITS — THE HEART */}
        <div className="mb-10">
          <div className="section-header px-1">
            <div>
              <div className="text-sm font-medium tracking-[1.5px] text-muted-foreground mb-1">
                TODAY&apos;S HABITS
              </div>
              <div className="text-2xl font-semibold tracking-[-0.6px]">
                {hasHabits ? "Build your streak" : "Start your ritual"}
              </div>
            </div>
            {hasHabits && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="gap-2 border-white/10 hover:bg-white/5"
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            )}
          </div>

          {!hasHabits ? (
            <div className="empty-state">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="text-xl font-medium tracking-tight">No habits yet</div>
              <p className="mt-2 max-w-sm text-muted-foreground">
                Add your first habit to begin tracking. Small daily actions compound into remarkable change.
              </p>

              {/* Suggestions */}
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => addSuggestion(s)}
                    className="suggestion-pill"
                  >
                    <span>{s.emoji}</span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>

              <Button
                onClick={() => setIsAddOpen(true)}
                className="mt-8 gap-2"
                size="lg"
              >
                <Plus className="h-4 w-4" /> Create custom habit
              </Button>

              <button
                onClick={loadDemoData}
                className="mt-3 text-xs text-muted-foreground/70 underline underline-offset-4 hover:text-muted-foreground"
              >
                Or load beautiful demo data
              </button>
            </div>
          ) : (
            <div className="habits-grid">
              <AnimatePresence>
                {habits.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* INSIGHTS & VISUALIZATIONS */}
        <div className="mb-6 px-1">
          <div className="text-sm font-medium tracking-[1.5px] text-muted-foreground mb-1">
            INSIGHTS
          </div>
          <div className="text-2xl font-semibold tracking-[-0.6px]">See your progress</div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 mb-6">
          {/* Weekly Bar Chart */}
          <Card className="lumina-card lg:col-span-3 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Weekly Completion
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-6">
              {hasHabits && weeklyChartData.some((d) => d.rate > 0) ? (
                <div className="h-[218px] -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData} barCategoryGap={18}>
                      <CartesianGrid strokeDasharray="2 2" stroke="oklch(1 0 0 / 0.06)" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis
                        domain={[0, 100]}
                        tickCount={5}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: "oklch(0.135 0.018 255)",
                          border: "1px solid oklch(1 0 0 / 0.1)",
                          borderRadius: "8px",
                          color: "oklch(0.97 0.008 255)",
                        }}
                        formatter={(value) => [`${value}%`, "Completion"]}
                      />
                      <Bar
                        dataKey="rate"
                        fill="oklch(0.68 0.165 178)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={52}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[190px] items-center justify-center text-muted-foreground text-sm">
                  Complete habits over a week to see your trend.
                </div>
              )}
            </CardContent>
          </Card>

          {/* 30-day Consistency */}
          <Card className="lumina-card lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold tracking-tight">
                30-Day Consistency
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasHabits ? (
                <div className="flex flex-wrap gap-1.5">
                  {consistency30.map((day, idx) => {
                    const intensity =
                      day.rate >= 90
                        ? "bg-primary"
                        : day.rate >= 60
                        ? "bg-primary/70"
                        : day.rate >= 30
                        ? "bg-primary/35"
                        : "bg-white/5";
                    return (
                      <div
                        key={idx}
                        className={`h-3.5 w-3.5 rounded-sm ${intensity} border border-white/10 transition-all`}
                        title={`${day.label} • ${day.rate}% (${day.count}/${day.total})`}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4">
                  Your consistency map will appear here.
                </div>
              )}
              <div className="mt-4 flex items-center gap-4 text-[10px] text-muted-foreground/70">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary" /> 90%+
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary/70" /> 60%+
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary/35" /> &lt;60%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI INSIGHTS — Prominent & Powerful */}
        <div className="ai-panel mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-[2px] uppercase">POWERED BY GROK</span>
              </div>
              <div className="text-2xl font-semibold tracking-[-0.5px]">AI Insights</div>
              <p className="text-sm text-muted-foreground mt-1">
                Personalized observations and recommendations based on your actual data.
              </p>
            </div>

            <Button
              onClick={generateAIInsights}
              disabled={isGenerating || !hasHabits}
              size="lg"
              className="gap-2 bg-primary/90 hover:bg-primary active:bg-primary text-primary-foreground shadow-sm min-w-[178px]"
            >
              {isGenerating ? (
                <>Analyzing your week…</>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {insights ? "Regenerate Insights" : "Generate Insights"}
                </>
              )}
            </Button>
          </div>

          {/* Insights output area */}
          <AnimatePresence mode="wait">
            {isGenerating && (
              <div className="rounded-xl border border-white/5 bg-black/20 p-8 text-center">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <div className="text-sm text-muted-foreground">Grok is studying your patterns…</div>
              </div>
            )}

            {insights && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="prose prose-invert max-w-none rounded-xl border border-white/5 bg-black/25 p-6 text-[15px] leading-relaxed"
              >
                <div className="whitespace-pre-wrap text-foreground/90">{insights}</div>
                <div className="mt-5 text-[10px] uppercase tracking-[1px] text-muted-foreground/60">
                  Based on the last 7 days + today&apos;s win
                </div>
              </motion.div>
            )}

            {!insights && !isGenerating && hasHabits && (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
                Click the button above to receive thoughtful, data-driven reflections and next steps from Grok.
              </div>
            )}
          </AnimatePresence>

          {!hasHabits && (
            <div className="text-xs text-muted-foreground/60">Add habits to unlock AI analysis.</div>
          )}
        </div>

        {/* Footer note */}
        <div className="text-center text-[11px] text-muted-foreground/50 mt-8">
          All data lives in your browser. Export anytime from Settings.
        </div>
      </main>

      {/* ADD HABIT DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New habit</DialogTitle>
            <DialogDescription>
              Small, specific, and repeatable. You can always edit later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-3">
            <div className="grid grid-cols-[78px,1fr] gap-3 items-end">
              <div>
                <Label className="text-xs tracking-widest text-muted-foreground mb-1.5 block">EMOJI</Label>
                <Input
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
                  className="h-14 text-center text-4xl border-white/10 bg-black/20"
                  maxLength={2}
                />
              </div>
              <div>
                <Label className="text-xs tracking-widest text-muted-foreground mb-1.5 block">HABIT NAME</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addHabit();
                  }}
                  placeholder="Read before bed"
                  className="h-14 text-lg border-white/10 bg-black/20"
                  autoFocus
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground px-1">
              Tip: Keep the name short and actionable.
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addHabit} disabled={!newName.trim()}>
              Create habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SETTINGS DIALOG — Manage + Export/Import */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage habits and your data. Everything is stored locally.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 py-2">
            {/* Habits list */}
            <div>
              <div className="text-xs tracking-[1px] text-muted-foreground mb-3 px-1">YOUR HABITS</div>
              {habits.length > 0 ? (
                <div className="space-y-1 rounded-xl border border-white/5 bg-black/20 p-1">
                  {habits.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{habit.emoji}</span>
                        <span>{habit.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/80 hover:text-destructive"
                        onClick={() => setIsDeleteHabitId(habit.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground px-1">No habits yet.</div>
              )}
            </div>

            <Separator className="divider" />

            {/* Data controls */}
            <div>
              <div className="text-xs tracking-[1px] text-muted-foreground mb-3 px-1">DATA</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportData} className="gap-2">
                  <Download className="h-4 w-4" /> Export JSON
                </Button>

                <label>
                  <Button
                    variant="outline"
                    className="gap-2 cursor-pointer"
                    onClick={() => document.getElementById("import-file-input")?.click()}
                  >
                    <Upload className="h-4 w-4" /> Import JSON
                  </Button>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={importData}
                  />
                </label>

                <Button
                  variant="outline"
                  onClick={loadDemoData}
                  className="gap-2 border-white/10"
                >
                  Load demo data
                </Button>

                <Button
                  variant="outline"
                  onClick={clearAllData}
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Clear everything
                </Button>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground/70 px-1">
                Export regularly if you want to keep a backup across devices.
              </p>
            </div>

            {/* AI Key notice */}
            <div className="rounded-xl border border-white/5 bg-black/30 p-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground/90">AI Insights</strong> use the xAI Grok API.
              Add <code className="font-mono text-[10px] bg-black/40 px-1 py-px rounded">XAI_API_KEY</code> to{" "}
              <code className="font-mono text-[10px]">.env.local</code> (or Vercel env vars) to enable live analysis.
              See the README for instructions.
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!isDeleteHabitId}
        onOpenChange={(open) => !open && setIsDeleteHabitId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove it and all its history from your local data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => isDeleteHabitId && deleteHabit(isDeleteHabitId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete habit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demo prompt for first-time users (subtle) */}
      {showDemoPrompt && hasHabits === false && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card/95 px-5 py-3 shadow-xl backdrop-blur">
            <div className="text-sm">Want to see Lumina in action?</div>
            <Button size="sm" variant="secondary" onClick={loadDemoData}>
              Load demo
            </Button>
            <button
              onClick={() => setShowDemoPrompt(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
