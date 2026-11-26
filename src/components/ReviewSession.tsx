"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { deckTitle } from "@/data/decks";
import { Board } from "@/components/Board";
import { noteIntroduced, useTrainer } from "@/context/TrainerContext";
import {
  explanationAt,
  hintText,
  motionDelay,
  playUserMove,
  replayLine,
  startFen,
} from "@/lib/lines";
import {
  createInitialSrs,
  formatDelay,
  formatDelayLong,
  previewDelays,
  suggestedRating,
  suggestionCopy,
} from "@/lib/srs";
import type { OpeningLine, Rating, SessionDeck } from "@/types";

const RATINGS: { id: Rating; label: string; className: string }[] = [
  { id: "again", label: "Again", className: "bg-rose-950 text-rose-200" },
  { id: "hard", label: "Hard", className: "bg-orange-950 text-orange-200" },
  { id: "good", label: "Good", className: "bg-emerald-950 text-emerald-200" },
  { id: "easy", label: "Easy", className: "bg-sky-950 text-sky-200" },
];

export function ReviewSession({ deck }: { deck: SessionDeck }) {
  const router = useRouter();
  const { lines, queueFor, rateCard } = useTrainer();
  const [queue, setQueue] = useState<string[]>(() => queueFor(deck).map((line) => line.id));
  const [round, setRound] = useState(0);
  const [startedFull] = useState(queue.length > 0);
  const currentId = queue[0];
  const line = lines.find((item) => item.id === currentId);

  const grade = (rating: Rating) => {
    if (!line) return;
    rateCard(line.id, rating);
    setQueue((current) => {
      const rest = current.slice(1);
      if (rating === "again") rest.splice(Math.min(2, rest.length), 0, line.id);
      return rest;
    });
    setRound((value) => value + 1);
  };

  if (!line) {
    return (
      <div className="flex h-full flex-col px-5">
        <button type="button" onClick={() => router.push("/")} className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-400">
          <ChevronLeft size={16} /> Decks
        </button>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-lg font-semibold">{startedFull ? "Session complete" : "Nothing due in this deck"}</p>
          <p className="mt-2 max-w-xs text-sm text-zinc-400">
            {startedFull
              ? "Your grades are saved on this device. Export a backup from Stats if you want a copy."
              : "Come back when cards are scheduled, or save a line from Explore."}
          </p>
        </div>
      </div>
    );
  }

  return <DrillCard key={`${line.id}-${round}`} line={line} deck={deck} remaining={queue.length} onGrade={grade} />;
}

function DrillCard({
  line,
  deck,
  remaining,
  onGrade,
}: {
  line: OpeningLine;
  deck: SessionDeck;
  remaining: number;
  onGrade: (rating: Rating) => void;
}) {
  const router = useRouter();
  const { srs, settings, updateSettings } = useTrainer();
  const replay = useMemo(() => replayLine(line.moves), [line.moves]);
  const openingFen = replay.ok ? replay.positions[0] : startFen();
  const [fen, setFen] = useState(openingFen);
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<"setup" | "play" | "rate">("setup");
  const [busy, setBusy] = useState(true);
  const [mistakes, setMistakes] = useState(0);
  const [moveMistakes, setMoveMistakes] = useState(0);
  const [wrong, setWrong] = useState<{ square: string; id: number } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!replay.ok) return;
    const { moves, positions } = replay;
    let timer = 0;
    let index = 0;
    const step = () => {
      if (!alive.current) return;
      if (index >= moves.length) {
        setFen(positions[positions.length - 1] ?? startFen());
        setPhase("rate");
        setBusy(false);
        return;
      }
      const move = moves[index];
      if (move.color !== line.playerColor) {
        setFen(positions[index + 1] ?? move.fen);
        setLastMove({ from: move.from, to: move.to });
        index += 1;
        timer = window.setTimeout(step, motionDelay());
        return;
      }
      setCursor(index);
      setFen(positions[index] ?? startFen());
      setBusy(false);
      setPhase("play");
    };
    timer = window.setTimeout(() => {
      if (!alive.current) return;
      noteIntroduced(line.id);
      step();
    }, motionDelay());
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
    };
  }, [line.id, line.playerColor, replay]);

  useEffect(() => {
    if (!wrong) return;
    const timer = window.setTimeout(() => setWrong(null), 450);
    return () => window.clearTimeout(timer);
  }, [wrong]);

  const card = srs[line.id] ?? createInitialSrs();
  const expected = replay.ok ? replay.moves[cursor] : undefined;
  const explanation = explanationAt(line, cursor);
  const hint = expected ? hintText(explanation, moveMistakes, expected.san) : null;
  const blind = settings.blindRecall && phase !== "rate";
  const title = blind ? "Blind recall" : line.name;
  const subtitle = phase === "rate" ? `${line.eco} · ${line.variation}` : blind ? deckTitle(deck) : line.variation;
  const suggestion = suggestedRating(mistakes, card);
  const delays = previewDelays(card);

  const continueLine = (fromIndex: number) => {
    if (!replay.ok) return;
    let index = fromIndex;
    const step = () => {
      if (!alive.current || !replay.ok) return;
      if (index >= replay.moves.length) {
        setFen(replay.positions[replay.positions.length - 1] ?? startFen());
        setPhase("rate");
        setBusy(false);
        return;
      }
      const move = replay.moves[index];
      if (move.color !== line.playerColor) {
        setFen(replay.positions[index + 1] ?? move.fen);
        setLastMove({ from: move.from, to: move.to });
        index += 1;
        window.setTimeout(step, motionDelay());
        return;
      }
      setCursor(index);
      setFen(replay.positions[index] ?? startFen());
      setBusy(false);
      setPhase("play");
    };
    window.setTimeout(step, motionDelay());
  };

  const onMove = (from: string, to: string) => {
    if (!replay.ok || !expected || busy || phase !== "play") return false;
    const played = playUserMove(fen, from, to);
    if (!played) return false;
    if (played.from !== expected.from || played.to !== expected.to) {
      setMistakes((count) => count + 1);
      setMoveMistakes((count) => count + 1);
      setWrong((current) => ({ square: to, id: (current?.id ?? 0) + 1 }));
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(24);
      return false;
    }
    setFen(replay.positions[cursor + 1] ?? played.fen);
    setLastMove({ from: played.from, to: played.to });
    setMoveMistakes(0);
    setWrong(null);
    setBusy(true);
    continueLine(cursor + 1);
    return true;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 px-3 pb-1 pt-2">
        <button type="button" aria-label="Back to decks" onClick={() => router.push("/")} className="rounded-full p-1.5 text-zinc-400">
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          <p className="truncate text-[11px] text-zinc-400">{subtitle}</p>
        </div>
        <button
          type="button"
          aria-label="Toggle blind recall"
          onClick={() => updateSettings({ blindRecall: !settings.blindRecall })}
          className="rounded-full p-1.5 text-zinc-400"
        >
          {settings.blindRecall ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <span className="text-xs font-medium tabular-nums text-zinc-500">{remaining} left</span>
      </header>
      <div className="mx-3 mb-1 h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-emerald-500"
          style={{ width: phase === "rate" ? "100%" : `${Math.min(100, (cursor / Math.max(line.moves.length, 1)) * 100)}%` }}
        />
      </div>
      <div className="min-h-0 flex-1 px-3 py-1">
        <Board
          fen={fen}
          orientation={line.playerColor === "w" ? "white" : "black"}
          interactive={phase === "play" && !busy}
          turn={line.playerColor}
          lastMove={lastMove}
          wrongSquare={wrong?.square}
          shakeKey={wrong?.id ?? 0}
          onMove={onMove}
        />
      </div>
      {phase === "rate" ? (
        <div className="px-3 pb-2">
          <p className="line-clamp-3 text-xs leading-snug text-zinc-200">{line.summaryPlan}</p>
          <p className={`mt-1 text-[11px] ${mistakes === 0 ? "text-emerald-300" : "text-orange-300"}`}>
            {mistakes === 0 ? "No mistakes" : `${mistakes} mistake${mistakes === 1 ? "" : "s"}`}
            <span className="text-zinc-500"> · {suggestionCopy(suggestion)}</span>
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {RATINGS.map((rating) => (
              <button
                key={rating.id}
                type="button"
                onClick={() => onGrade(rating.id)}
                aria-label={`${rating.label}, next review in ${formatDelayLong(delays[rating.id])}`}
                className={`rounded-xl px-1 py-2 text-center ${rating.className} ${
                  suggestion === rating.id ? "ring-2 ring-emerald-400" : ""
                }`}
              >
                <span className="block text-xs font-semibold">{rating.label}</span>
                <span className="mt-0.5 block text-[10px] tabular-nums opacity-80">{formatDelay(delays[rating.id])}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-3 mb-2 flex h-11 items-center">
          <p className={`line-clamp-2 text-xs leading-snug ${hint ? "text-amber-200" : "text-zinc-400"}`}>
            {busy && phase === "setup"
              ? "Setting up the position…"
              : hint || "Your move. A wrong try flashes red and you can play again."}
          </p>
        </div>
      )}
    </div>
  );
}
