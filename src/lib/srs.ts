import type {
  CardStatus,
  OpeningLine,
  Rating,
  SessionDeck,
  SrsState,
  Streak,
} from "@/types";
import { DECK_IDS } from "@/data/decks";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export function createInitialSrs(now = 0): SrsState {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: now,
    status: "new",
    lapses: 0,
    lastReviewed: null,
  };
}

export function dayKey(ts: number): string {
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function previousDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return dayKey(date.getTime());
}

export function endOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function visibleStreak(streak: Streak, now: number): number {
  if (!streak.lastDate || streak.count <= 0) return 0;
  const today = dayKey(now);
  if (streak.lastDate === today || streak.lastDate === previousDayKey(today)) return streak.count;
  return 0;
}

export function updateStreak(streak: Streak, now: number): Streak {
  const today = dayKey(now);
  if (streak.lastDate === today) return streak;
  if (streak.lastDate && streak.lastDate === previousDayKey(today)) {
    return { count: streak.count + 1, lastDate: today };
  }
  return { count: 1, lastDate: today };
}

export interface DelayPreview {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

/**
 * Anki-style SM-2 delays, in milliseconds.
 * Again is under a minute. Hard is 12h early, otherwise 1.2x.
 * Good is 1d, then 6d, then interval x ease. Easy starts at 4d and boosts ease.
 */
export function previewDelays(card: SrsState): DelayPreview {
  const ease = card.easeFactor;
  const interval = card.interval;
  const reps = card.repetitions;

  const hardDays = reps === 0 || interval < 1 ? 0.5 : interval * 1.2;

  let goodDays: number;
  if (reps === 0) goodDays = 1;
  else if (reps === 1) goodDays = 6;
  else goodDays = Math.max(interval * ease, 1);

  const easyDays = reps === 0 ? 4 : Math.max(interval * ease * 1.3, 4);

  return {
    again: MINUTE,
    hard: hardDays * DAY,
    good: goodDays * DAY,
    easy: easyDays * DAY,
  };
}

export function formatDelay(ms: number): string {
  const hour = 60 * MINUTE;
  if (ms < 2 * MINUTE) return "< 1m";
  if (ms < DAY) {
    const hours = Math.round(ms / hour);
    return hours === 12 ? "~12h" : `${hours}h`;
  }
  return `${Math.round(ms / DAY)}d`;
}

export function formatDelayLong(ms: number): string {
  const label = formatDelay(ms);
  if (label === "< 1m") return "less than a minute";
  if (label.endsWith("h")) return label.replace("~", "");
  if (label === "1d") return "1 day";
  if (label.endsWith("d")) return `${label.slice(0, -1)} days`;
  return label;
}

function statusFor(rating: Rating, intervalDays: number, repetitions: number): CardStatus {
  if (rating === "again" || intervalDays < 1) return "learning";
  if (intervalDays >= 21 && repetitions >= 3) return "mastered";
  return "review";
}

export function applyRating(card: SrsState, rating: Rating, now: number): SrsState {
  const delays = previewDelays(card);
  let ease = card.easeFactor;
  let repetitions = card.repetitions;
  let lapses = card.lapses;

  if (rating === "again") {
    repetitions = 0;
    ease = Math.max(1.3, ease - 0.2);
    lapses += 1;
  } else if (rating === "hard") {
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === "good") {
    repetitions += 1;
  } else {
    repetitions += 1;
    ease += 0.15;
  }

  const intervalDays = rating === "again" ? 0 : delays[rating] / DAY;
  ease = Math.round(ease * 100) / 100;

  return {
    easeFactor: ease,
    interval: Math.round(intervalDays * 1000) / 1000,
    repetitions,
    dueDate: now + delays[rating],
    status: statusFor(rating, intervalDays, repetitions),
    lapses,
    lastReviewed: now,
  };
}

export function suggestedRating(mistakes: number, card: SrsState): Rating {
  if (mistakes <= 0) return card.repetitions >= 2 ? "easy" : "good";
  if (mistakes === 1) return "hard";
  return "again";
}

export function suggestionCopy(rating: Rating): string {
  if (rating === "easy") return "Clean recall on a familiar line. Easy fits.";
  if (rating === "good") return "Clean recall. Good is a fair grade.";
  if (rating === "hard") return "One slip. Hard keeps a shorter interval.";
  return "This line needs another look. Again brings it back.";
}

function byDue(srs: Record<string, SrsState>) {
  return (a: OpeningLine, b: OpeningLine) =>
    (srs[a.id]?.dueDate ?? 0) - (srs[b.id]?.dueDate ?? 0);
}

function sessionForDeck(
  deck: OpeningLine["deck"],
  lines: OpeningLine[],
  srs: Record<string, SrsState>,
  introducedToday: string[],
  newPerDay: number,
  now: number,
): OpeningLine[] {
  const end = endOfDay(now);
  const pool = lines.filter((line) => line.deck === deck);
  const introduced = new Set(introducedToday);
  const learning = pool
    .filter((line) => {
      const card = srs[line.id];
      return card?.status === "learning" && card.dueDate <= end;
    })
    .sort(byDue(srs));
  const due = pool
    .filter((line) => {
      const card = srs[line.id];
      return (card?.status === "review" || card?.status === "mastered") && card.dueDate <= end;
    })
    .sort(byDue(srs));
  const used = pool.filter((line) => introduced.has(line.id)).length;
  const slots = Math.max(0, newPerDay - used);
  const already = pool.filter((line) => {
    const card = srs[line.id];
    return (!card || card.status === "new") && introduced.has(line.id);
  });
  const waiting = pool.filter((line) => {
    const card = srs[line.id];
    return (!card || card.status === "new") && !introduced.has(line.id);
  });
  return [...learning, ...due, ...already, ...waiting.slice(0, slots)];
}

export function weakestLines(
  lines: OpeningLine[],
  srs: Record<string, SrsState>,
  limit = 10,
): OpeningLine[] {
  return lines
    .filter((line) => srs[line.id]?.lastReviewed != null)
    .sort((a, b) => {
      const left = srs[a.id];
      const right = srs[b.id];
      return left.easeFactor - right.easeFactor || right.lapses - left.lapses;
    })
    .slice(0, limit);
}

export function sessionLines(
  deck: SessionDeck,
  lines: OpeningLine[],
  srs: Record<string, SrsState>,
  introducedToday: string[],
  newPerDay: number,
  now: number,
): OpeningLine[] {
  if (deck === "weak") return weakestLines(lines, srs, 10);
  if (deck === "all") {
    const combined = DECK_IDS.flatMap((id) =>
      sessionForDeck(id, lines, srs, introducedToday, newPerDay, now),
    );
    const rank = (line: OpeningLine) => {
      const status = srs[line.id]?.status ?? "new";
      if (status === "learning") return 0;
      if (status === "new") return 2;
      return 1;
    };
    return combined.sort(
      (a, b) => rank(a) - rank(b) || (srs[a.id]?.dueDate ?? 0) - (srs[b.id]?.dueDate ?? 0),
    );
  }
  return sessionForDeck(deck, lines, srs, introducedToday, newPerDay, now);
}

export interface DeckTally {
  fresh: number;
  learning: number;
  due: number;
}

export function tallyLines(
  lines: OpeningLine[],
  srs: Record<string, SrsState>,
): DeckTally {
  let fresh = 0;
  let learning = 0;
  let due = 0;
  for (const line of lines) {
    const status = srs[line.id]?.status ?? "new";
    if (status === "new") fresh += 1;
    else if (status === "learning") learning += 1;
    else due += 1;
  }
  return { fresh, learning, due };
}
