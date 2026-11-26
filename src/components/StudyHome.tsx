"use client";

import Link from "next/link";
import { ChevronRight, Eye, EyeOff, Flame } from "lucide-react";
import { DECKS } from "@/data/decks";
import { LoadingScreen } from "@/components/AppShell";
import { useTrainer } from "@/context/TrainerContext";
import { useNow } from "@/lib/clock";
import { visibleStreak } from "@/lib/srs";
import type { SessionDeck } from "@/types";

function Count({ value, tone }: { value: number; tone: "new" | "learn" | "due" }) {
  const color =
    value === 0
      ? "bg-zinc-800 text-zinc-500"
      : tone === "new"
        ? "bg-blue-500/15 text-blue-400"
        : tone === "learn"
          ? "bg-orange-500/15 text-orange-400"
          : "bg-emerald-500/15 text-emerald-400";
  return (
    <span className={`inline-flex min-w-9 justify-center rounded-md px-2 py-1 text-sm font-bold tabular-nums ${color}`}>
      {value}
    </span>
  );
}

function DeckLink({ deck }: { deck: SessionDeck }) {
  const { tallyFor } = useTrainer();
  const tally = tallyFor(deck);
  const meta =
    deck === "all"
      ? { title: "All Due Cards", blurb: "Learning, reviews, and new cards from every deck" }
      : DECKS.find((item) => item.id === deck);
  if (!meta) return null;
  const total = tally.fresh + tally.learning + tally.due;

  return (
    <Link
      href={`/review?deck=${deck}`}
      className="block rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 active:bg-zinc-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{meta.title}</h2>
          <p className="mt-0.5 text-xs text-zinc-400">{meta.blurb}</p>
        </div>
        <ChevronRight className="mt-0.5 shrink-0 text-zinc-600" size={18} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Count value={tally.fresh} tone="new" />
        <Count value={tally.learning} tone="learn" />
        <Count value={tally.due} tone="due" />
        <span className="ml-auto text-[11px] text-zinc-500">{total === 0 ? "Clear" : `${total} now`}</span>
      </div>
    </Link>
  );
}

export function StudyHome() {
  const { ready, settings, streak, updateSettings } = useTrainer();
  const now = useNow();
  if (!ready) return <LoadingScreen />;
  const streakCount = visibleStreak(streak, now);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-400">Repertoire</p>
          <h1 className="text-xl font-semibold tracking-tight">Opening Trainer</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-orange-300">
          <Flame size={16} />
          {streakCount}
        </div>
      </header>
      <div className="flex items-center justify-between gap-3 px-4 pb-3">
        <p className="text-xs text-zinc-400">
          <span className="font-semibold text-blue-400">New</span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span className="font-semibold text-orange-400">Learn</span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span className="font-semibold text-emerald-400">Due</span>
        </p>
        <button
          type="button"
          onClick={() => updateSettings({ blindRecall: !settings.blindRecall })}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            settings.blindRecall ? "bg-indigo-500/20 text-indigo-300" : "bg-zinc-900 text-zinc-400"
          }`}
        >
          {settings.blindRecall ? <EyeOff size={13} /> : <Eye size={13} />}
          Blind
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
        <DeckLink deck="all" />
        {DECKS.map((deck) => (
          <DeckLink key={deck.id} deck={deck.id} />
        ))}
        <p className="px-1 pt-1 text-center text-[11px] text-zinc-500">
          {settings.newPerDay} new cards per deck each day. Play every move on the board.
        </p>
      </div>
    </div>
  );
}
