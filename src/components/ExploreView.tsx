"use client";

import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, BookmarkPlus, Eye, EyeOff, RotateCcw, Undo2 } from "lucide-react";
import { Board } from "@/components/Board";
import { LoadingScreen } from "@/components/AppShell";
import { useTrainer } from "@/context/TrainerContext";
import { motionDelay, replayLine, sideFromFen, startFen } from "@/lib/lines";
import { createOpeningIndex, identifyPosition, visibleCoachText } from "@/lib/openingMatcher";
import type { Color } from "@/types";

type Spar = Color | "both";

export function ExploreView() {
  const { ready, lines, settings, updateSettings, addCustomLine } = useTrainer();
  const [sans, setSans] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [spar, setSpar] = useState<Spar>("both");
  const [pinnedFen, setPinnedFen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [notice, setNotice] = useState("");

  const index = useMemo(() => createOpeningIndex(lines), [lines]);
  const replay = useMemo(() => replayLine(sans), [sans]);
  const fen = replay.ok ? replay.positions[replay.positions.length - 1] : startFen();
  const identification = useMemo(() => identifyPosition(fen, index), [fen, index]);
  const showArrows = settings.showArrows;

  const coachOpen = pinnedFen === fen;

  useEffect(() => {
    if (spar === "both" || !replay.ok || replay.turn === spar || !identification.mainSan) return;
    const san = identification.mainSan;
    const length = sans.length;
    const timer = window.setTimeout(() => {
      setSans((current) => {
        if (current.length !== length) return current;
        return replayLine([...current, san]).ok ? [...current, san] : current;
      });
    }, motionDelay() + 90);
    return () => window.clearTimeout(timer);
  }, [identification.mainSan, replay, sans.length, spar]);

  if (!ready) return <LoadingScreen />;

  const turn = sideFromFen(fen);
  const botMoving = spar !== "both" && turn !== spar && Boolean(identification.mainSan);
  const interactive = !botMoving;
  const boardTurn: Color | "both" = spar === "both" || (turn !== spar && !identification.mainSan) ? "both" : spar;
  const coach = visibleCoachText(identification, showArrows);
  const plan =
    identification.summary && identification.summary !== identification.explanation ? identification.summary : "";

  const onMove = (from: string, to: string) => {
    try {
      const chess = new Chess(fen);
      const move = chess.move({ from, to, promotion: "q" });
      if (!move) return false;
      setSans((current) => [...current, move.san]);
      return true;
    } catch {
      return false;
    }
  };

  const chooseSpar = (next: Spar) => {
    setSpar(next);
    if (next === "w") setOrientation("white");
    if (next === "b") setOrientation("black");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 px-3 pb-1 pt-2">
        <h1 className="text-sm font-semibold">Explore</h1>
        <div className="ml-auto flex rounded-full bg-zinc-900 p-0.5 text-[11px] font-semibold">
          {(
            [
              ["both", "Both"],
              ["w", "White"],
              ["b", "Black"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => chooseSpar(id)}
              className={`rounded-full px-2.5 py-1 ${spar === id ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 px-3">
        <Board
          fen={fen}
          orientation={orientation}
          interactive={interactive}
          turn={boardTurn}
          arrows={showArrows ? identification.arrows : []}
          lastMove={
            replay.ok && replay.moves.length > 0
              ? {
                  from: replay.moves[replay.moves.length - 1].from,
                  to: replay.moves[replay.moves.length - 1].to,
                }
              : null
          }
          onMove={onMove}
        />
      </div>
      <button type="button" onClick={() => setPinnedFen(coachOpen ? null : fen)} className="mx-3 mb-1 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-sm font-semibold">{identification.name}</h2>
          <span className="shrink-0 text-xs font-semibold text-emerald-400">{identification.eco}</span>
        </div>
        <p className="truncate text-[11px] text-zinc-500">{identification.variation}</p>
        <p className={`mt-0.5 text-xs leading-snug text-zinc-300 ${coachOpen ? "" : "line-clamp-2"}`}>{coach}</p>
        {coachOpen && plan ? <p className="mt-1 text-xs leading-snug text-zinc-400">{plan}</p> : null}
        {showArrows && identification.arrows.length > 1 ? (
          <p className="mt-0.5 text-[10px] text-zinc-500">Green is the main move. Blue arrows are other repertoire tries.</p>
        ) : null}
      </button>
      {notice ? <p className="px-3 pb-1 text-center text-[11px] text-emerald-300">{notice}</p> : null}
      <div className="grid grid-cols-4 gap-1.5 px-3 pb-2">
        <Control
          label="Undo"
          icon={<Undo2 size={16} />}
          disabled={sans.length === 0}
          onClick={() => setSans((current) => current.slice(0, -1))}
        />
        <Control
          label="Flip"
          icon={<ArrowLeftRight size={16} />}
          onClick={() => setOrientation((side) => (side === "white" ? "black" : "white"))}
        />
        <Control label="Reset" icon={<RotateCcw size={16} />} disabled={sans.length === 0} onClick={() => setSans([])} />
        <Control
          label="Save"
          icon={<BookmarkPlus size={16} />}
          onClick={() => {
            if (sans.length < 2) {
              setNotice("Play at least two moves before saving.");
              return;
            }
            setNotice("");
            setSheet(true);
          }}
        />
      </div>
      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={() => updateSettings({ showArrows: !showArrows })}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400"
        >
          {showArrows ? <Eye size={13} /> : <EyeOff size={13} />}
          {showArrows ? "Hide arrows" : "Show arrows"}
        </button>
      </div>
      {sheet ? (
        <SaveSheet
          defaultColor={spar === "both" ? (orientation === "white" ? "w" : "b") : spar}
          suggested={identification.matched && identification.ply > 0 ? identification.name : ""}
          onClose={() => setSheet(false)}
          onSave={(name, note, playerColor) => {
            const id = addCustomLine({ name, note, playerColor, moves: sans });
            setSheet(false);
            setNotice(id ? "Saved to My Lines." : "Name the line before saving.");
          }}
        />
      ) : null}
    </div>
  );
}

function Control({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl bg-zinc-900 py-2 text-[11px] font-medium text-zinc-200 disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function SaveSheet({
  defaultColor,
  suggested,
  onClose,
  onSave,
}: {
  defaultColor: Color;
  suggested: string;
  onClose: () => void;
  onSave: (name: string, note: string, color: Color) => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [color, setColor] = useState<Color>(defaultColor);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60">
      <form
        className="w-full max-w-lg rounded-t-3xl bg-zinc-900 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(name, note, color);
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
        <h2 className="text-base font-semibold">Add to Anki deck</h2>
        <p className="mt-1 text-xs text-zinc-400">
          {suggested ? `Board looks like ${suggested}. ` : ""}You will drill only your color. The other side answers automatically.
        </p>
        <label className="mt-3 block text-xs font-medium text-zinc-300" htmlFor="line-name">
          Name
        </label>
        <input
          id="line-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My Fried Liver Counter"
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base outline-none focus:border-emerald-500"
        />
        <label className="mt-3 block text-xs font-medium text-zinc-300" htmlFor="line-note">
          Coach note
        </label>
        <textarea
          id="line-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Why this move works for me"
          className="mt-1 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base outline-none focus:border-emerald-500"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["w", "I play White"],
              ["b", "I play Black"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setColor(id)}
              className={`rounded-xl py-2 text-sm font-medium ${
                color === id ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-zinc-800 py-3 text-sm font-semibold">
            Cancel
          </button>
          <button type="submit" className="rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950">
            Add to deck
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
