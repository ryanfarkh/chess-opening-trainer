"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, Trash2, Upload } from "lucide-react";
import { LoadingScreen } from "@/components/AppShell";
import { useTrainer } from "@/context/TrainerContext";
import { useNow } from "@/lib/clock";
import { dayKey, endOfDay, visibleStreak } from "@/lib/srs";
import { validateBackup } from "@/lib/storage";
import type { PersistedState } from "@/types";

function heatCells(reviews: Record<string, number>, now: number) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - 15 * 7);
  const todayKey = dayKey(now);
  const cells = [];
  for (let index = 0; index < 16 * 7; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dayKey(date.getTime());
    cells.push({
      key,
      count: key > todayKey ? -1 : (reviews[key] ?? 0),
      label: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    });
  }
  return cells;
}

function cellClass(count: number) {
  if (count < 0) return "bg-transparent";
  if (count === 0) return "bg-zinc-800";
  if (count < 3) return "bg-emerald-900";
  if (count < 6) return "bg-emerald-600";
  return "bg-emerald-400";
}

export function StatsView() {
  const { ready, snapshot, srs, lines, streak, reviewsByDay, customLines, weakest, tallyFor, removeCustomLine, restoreBackup } =
    useTrainer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PersistedState | null>(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const now = useNow();

  if (!ready || !snapshot) return <LoadingScreen />;
  const mastered = Object.values(srs).filter((card) => card.status === "mastered").length;
  const tally = tallyFor("all");
  const dueToday = tally.learning + tally.due;
  const cells = heatCells(reviewsByDay, now);
  const streakCount = visibleStreak(streak, now);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "opening-trainer-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Backup downloaded.");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-400">Progress</p>
      <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat value={String(mastered)} label="Mastered" />
        <Stat value={String(dueToday)} label="Due today" />
        <Stat value={String(streakCount)} label="Streak" />
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Review heatmap</h2>
          <span className="text-[11px] text-zinc-500">{selected || "Last 16 weeks"}</span>
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1">
          {cells.map((cell) => (
            <button
              key={cell.key + cell.count}
              type="button"
              aria-label={`${cell.label}, ${Math.max(cell.count, 0)} reviews`}
              disabled={cell.count < 0}
              onClick={() => setSelected(`${cell.label} · ${cell.count} review${cell.count === 1 ? "" : "s"}`)}
              className={`h-3.5 w-3.5 rounded-[3px] ${cellClass(cell.count)}`}
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Weakest lines</h2>
          {weakest.length > 0 ? (
            <Link href="/review?deck=weak" className="rounded-full bg-orange-500/15 px-3 py-1 text-[11px] font-semibold text-orange-300">
              Drill weakest
            </Link>
          ) : null}
        </div>
        {weakest.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">Review a few cards and the shakiest lines will show up here.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {weakest.map((line) => {
              const card = srs[line.id];
              return (
                <li key={line.id} className="rounded-xl bg-zinc-900 px-3 py-2">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-[11px] text-zinc-400">
                    {line.variation} · ease {card?.easeFactor.toFixed(2)} · {card?.lapses ?? 0} lapses
                    {card && card.dueDate > endOfDay(now) ? "" : " · due"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">My lines</h2>
        {customLines.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Play a sequence in Explore and tap Save. It joins the My Lines deck.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {customLines.map((line) => (
              <li key={line.id} className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {line.playerColor === "w" ? "White" : "Black"} · {line.moves.length} plies
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${line.name}`}
                  onClick={() => {
                    if (armedDelete === line.id) {
                      removeCustomLine(line.id);
                      setArmedDelete(null);
                    } else {
                      setArmedDelete(line.id);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-rose-300"
                >
                  <Trash2 size={14} />
                  {armedDelete === line.id ? "Confirm" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Backup</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Progress lives in this browser. Export a JSON file before you clear site data. {lines.length} lines are in the app.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={exportBackup} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-medium">
            <Download size={16} /> Export
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-medium"
          >
            <Upload size={16} /> Import
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const result = validateBackup(await file.text());
            if (!result.ok) {
              setPending(null);
              setMessage(result.error);
              return;
            }
            setPending(result.state);
            setMessage("This replaces the progress on this device.");
          }}
        />
        {pending ? (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-100">{message}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPending(null)} className="rounded-lg bg-zinc-800 py-2 text-xs font-semibold">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  restoreBackup(pending);
                  setPending(null);
                  setMessage("Backup restored.");
                }}
                className="rounded-lg bg-amber-400 py-2 text-xs font-semibold text-zinc-950"
              >
                Replace progress
              </button>
            </div>
          </div>
        ) : message ? (
          <p className="mt-2 text-xs text-zinc-400">{message}</p>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900 px-2 py-3 text-center">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}
