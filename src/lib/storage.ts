import { OPENINGS } from "@/data/openings";
import { createInitialSrs } from "@/lib/srs";
import { replayLine } from "@/lib/lines";
import type { OpeningLine, PersistedState, Settings, SrsState, Streak } from "@/types";

export const STORAGE_KEY = "opening-trainer-v1";

export function defaultSettings(): Settings {
  return { blindRecall: false, showArrows: true, newPerDay: 10 };
}

export function defaultState(now = Date.now()): PersistedState {
  const srs: Record<string, SrsState> = {};
  for (const line of OPENINGS) srs[line.id] = createInitialSrs(now);
  return {
    version: 1,
    srs,
    customLines: [],
    streak: { count: 0, lastDate: null },
    reviewsByDay: {},
    introducedByDay: {},
    settings: defaultSettings(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSrs(value: unknown): SrsState | null {
  if (!isRecord(value)) return null;
  const status = value.status;
  if (status !== "new" && status !== "learning" && status !== "review" && status !== "mastered") {
    return null;
  }
  if (
    typeof value.easeFactor !== "number" ||
    typeof value.interval !== "number" ||
    typeof value.repetitions !== "number" ||
    typeof value.dueDate !== "number"
  ) {
    return null;
  }
  return {
    easeFactor: Math.min(5, Math.max(1.3, value.easeFactor)),
    interval: Math.max(0, value.interval),
    repetitions: Math.max(0, Math.floor(value.repetitions)),
    dueDate: value.dueDate,
    status,
    lapses: typeof value.lapses === "number" ? Math.max(0, Math.floor(value.lapses)) : 0,
    lastReviewed: typeof value.lastReviewed === "number" ? value.lastReviewed : null,
  };
}

function sanitizeLine(value: unknown): OpeningLine | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (!Array.isArray(value.moves) || value.moves.some((move) => typeof move !== "string")) return null;
  const moves = value.moves as string[];
  if (moves.length < 2 || moves.length > 40) return null;
  const replay = replayLine(moves);
  if (!replay.ok) return null;
  const playerColor = value.playerColor === "b" ? "b" : "w";
  const explanations = Array.isArray(value.moveExplanations)
    ? value.moveExplanations.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: value.id,
    eco: typeof value.eco === "string" && value.eco.trim() ? value.eco : "CUST",
    deck: "custom",
    name: value.name.trim() || "Custom line",
    variation: typeof value.variation === "string" && value.variation.trim() ? value.variation : "Custom",
    playerColor,
    moves,
    moveExplanations: explanations,
    summaryPlan:
      typeof value.summaryPlan === "string" && value.summaryPlan.trim()
        ? value.summaryPlan
        : "Play the move you saved and remember why you chose it.",
    custom: true,
  };
}

function sanitizeStreak(value: unknown): Streak {
  if (!isRecord(value)) return { count: 0, lastDate: null };
  return {
    count: typeof value.count === "number" ? Math.max(0, Math.floor(value.count)) : 0,
    lastDate: typeof value.lastDate === "string" ? value.lastDate : null,
  };
}

function sanitizeSettings(value: unknown): Settings {
  const defaults = defaultSettings();
  if (!isRecord(value)) return defaults;
  return {
    blindRecall: typeof value.blindRecall === "boolean" ? value.blindRecall : defaults.blindRecall,
    showArrows: typeof value.showArrows === "boolean" ? value.showArrows : defaults.showArrows,
    newPerDay:
      typeof value.newPerDay === "number"
        ? Math.min(40, Math.max(1, Math.floor(value.newPerDay)))
        : defaults.newPerDay,
  };
}

export function mergeState(raw: unknown, now = Date.now()): PersistedState {
  const base = defaultState(now);
  if (!isRecord(raw)) return base;

  const srs: Record<string, SrsState> = {};
  const incoming = isRecord(raw.srs) ? raw.srs : {};
  for (const line of OPENINGS) {
    srs[line.id] = sanitizeSrs(incoming[line.id]) ?? createInitialSrs(now);
  }

  const customLines = Array.isArray(raw.customLines)
    ? raw.customLines.map(sanitizeLine).filter((line): line is OpeningLine => line !== null)
    : [];
  const seen = new Set<string>();
  const uniqueCustom = customLines.filter((line) => {
    if (seen.has(line.id) || OPENINGS.some((opening) => opening.id === line.id)) return false;
    seen.add(line.id);
    return true;
  });
  for (const line of uniqueCustom) {
    srs[line.id] = sanitizeSrs(incoming[line.id]) ?? createInitialSrs(now);
  }

  const reviewsByDay: Record<string, number> = {};
  if (isRecord(raw.reviewsByDay)) {
    for (const [key, count] of Object.entries(raw.reviewsByDay)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof count === "number" && count >= 0) {
        reviewsByDay[key] = Math.floor(count);
      }
    }
  }

  const introducedByDay: Record<string, string[]> = {};
  if (isRecord(raw.introducedByDay)) {
    for (const [key, ids] of Object.entries(raw.introducedByDay)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(ids)) continue;
      introducedByDay[key] = ids.filter((id): id is string => typeof id === "string" && id in srs);
    }
  }

  return {
    version: 1,
    srs,
    customLines: uniqueCustom,
    streak: sanitizeStreak(raw.streak),
    reviewsByDay,
    introducedByDay,
    settings: sanitizeSettings(raw.settings),
  };
}

export function loadState(): PersistedState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return mergeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const serverState = defaultState(0);
let clientState: PersistedState | null = null;
const listeners = new Set<() => void>();

export function subscribeTrainer(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTrainerState(): PersistedState {
  if (typeof window === "undefined") return serverState;
  if (!clientState) clientState = loadState();
  return clientState;
}

export function getServerTrainerState(): PersistedState {
  return serverState;
}

export function isServerSnapshot(state: PersistedState): boolean {
  return state === serverState;
}

export function updateTrainerState(recipe: (prev: PersistedState) => PersistedState) {
  const prev = getTrainerState();
  const next = recipe(prev);
  if (next === prev) return;
  clientState = next;
  saveState(next);
  listeners.forEach((listener) => listener());
}

export function validateBackup(raw: string): { ok: true; state: PersistedState } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) {
      return { ok: false, error: "That file is not an Opening Trainer backup." };
    }
    return { ok: true, state: mergeState(parsed) };
  } catch {
    return { ok: false, error: "Could not read that file. Choose a JSON backup." };
  }
}
