"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { OPENINGS } from "@/data/openings";
import { useNow } from "@/lib/clock";
import { playerMoveCount, replayLine } from "@/lib/lines";
import { applyRating, dayKey, sessionLines, tallyLines, updateStreak, weakestLines } from "@/lib/srs";
import {
  getServerTrainerState,
  getTrainerState,
  isServerSnapshot,
  subscribeTrainer,
  updateTrainerState,
} from "@/lib/storage";
import type { Color, OpeningLine, PersistedState, Rating, SessionDeck, Settings } from "@/types";

interface CustomLineInput {
  name: string;
  note: string;
  playerColor: Color;
  moves: string[];
}

interface TrainerContextValue {
  ready: boolean;
  snapshot: PersistedState | null;
  lines: OpeningLine[];
  srs: PersistedState["srs"];
  settings: Settings;
  streak: PersistedState["streak"];
  reviewsByDay: Record<string, number>;
  customLines: OpeningLine[];
  queueFor: (deck: SessionDeck) => OpeningLine[];
  tallyFor: (deck: SessionDeck) => { fresh: number; learning: number; due: number };
  weakest: OpeningLine[];
  updateSettings: (partial: Partial<Settings>) => void;
  rateCard: (id: string, rating: Rating) => void;
  addCustomLine: (input: CustomLineInput) => string | null;
  removeCustomLine: (id: string) => void;
  restoreBackup: (state: PersistedState) => void;
}

const TrainerContext = createContext<TrainerContextValue | null>(null);

export function noteIntroduced(id: string) {
  updateTrainerState((prev) => {
    const card = prev.srs[id];
    if (!card || card.status !== "new") return prev;
    const key = dayKey(Date.now());
    const existing = prev.introducedByDay[key] ?? [];
    if (existing.includes(id)) return prev;
    return {
      ...prev,
      introducedByDay: { ...prev.introducedByDay, [key]: [...existing, id] },
    };
  });
}

export function TrainerProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribeTrainer, getTrainerState, getServerTrainerState);
  const now = useNow();
  const ready = !isServerSnapshot(state) && now !== 0;

  const value = useMemo<TrainerContextValue>(() => {
    const lines = [...OPENINGS, ...state.customLines];
    const introducedToday = state.introducedByDay[dayKey(now)] ?? [];
    const queueFor = (deck: SessionDeck) =>
      ready
        ? sessionLines(deck, lines, state.srs, introducedToday, state.settings.newPerDay, now)
        : [];

    return {
      ready,
      snapshot: ready ? state : null,
      lines,
      srs: state.srs,
      settings: state.settings,
      streak: state.streak,
      reviewsByDay: state.reviewsByDay,
      customLines: state.customLines,
      queueFor,
      tallyFor: (deck) => tallyLines(queueFor(deck), state.srs),
      weakest: weakestLines(lines, state.srs, 5),
      updateSettings: (partial) => {
        updateTrainerState((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
      },
      rateCard: (id, rating) => {
        updateTrainerState((prev) => {
          const card = prev.srs[id];
          if (!card) return prev;
          const reviewedAt = Date.now();
          const key = dayKey(reviewedAt);
          return {
            ...prev,
            srs: { ...prev.srs, [id]: applyRating(card, rating, reviewedAt) },
            streak: updateStreak(prev.streak, reviewedAt),
            reviewsByDay: { ...prev.reviewsByDay, [key]: (prev.reviewsByDay[key] ?? 0) + 1 },
          };
        });
      },
      addCustomLine: (input) => {
        const name = input.name.trim();
        if (!name || input.moves.length < 2 || !replayLine(input.moves).ok) return null;
        const note = input.note.trim();
        const explanation = note
          ? `${note.replace(/\s+/g, " ")} Play the move you chose for this position.`
          : "Recall the idea you had when you saved this position. Play the move you chose here.";
        const id = `custom-${crypto.randomUUID()}`;
        const line: OpeningLine = {
          id,
          eco: "CUST",
          deck: "custom",
          name,
          variation: "Custom",
          playerColor: input.playerColor,
          moves: input.moves,
          moveExplanations: Array.from(
            { length: playerMoveCount(input.moves, input.playerColor) },
            () => explanation,
          ),
          summaryPlan: note || "A line you saved to drill with the rest of your repertoire.",
          custom: true,
        };
        updateTrainerState((prev) => ({
          ...prev,
          customLines: [...prev.customLines, line],
          srs: {
            ...prev.srs,
            [id]: {
              easeFactor: 2.5,
              interval: 0,
              repetitions: 0,
              dueDate: Date.now(),
              status: "new",
              lapses: 0,
              lastReviewed: null,
            },
          },
        }));
        return id;
      },
      removeCustomLine: (id) => {
        updateTrainerState((prev) => {
          const srs = { ...prev.srs };
          delete srs[id];
          return { ...prev, srs, customLines: prev.customLines.filter((line) => line.id !== id) };
        });
      },
      restoreBackup: (next) => updateTrainerState(() => next),
    };
  }, [now, ready, state]);

  return <TrainerContext.Provider value={value}>{children}    </TrainerContext.Provider>;
}

export function useTrainer() {
  const value = useContext(TrainerContext);
  if (!value) throw new Error("useTrainer must be used within TrainerProvider");
  return value;
}
