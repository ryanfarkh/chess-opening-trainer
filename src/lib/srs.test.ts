import { describe, expect, it } from "vitest";
import type { OpeningLine, SrsState } from "@/types";
import {
  applyRating,
  createInitialSrs,
  formatDelay,
  previewDelays,
  sessionLines,
  suggestedRating,
  updateStreak,
  visibleStreak,
} from "@/lib/srs";

const noon = new Date(2026, 0, 15, 12).getTime();

function rate(card: SrsState, rating: "again" | "hard" | "good" | "easy", now: number) {
  return applyRating(card, rating, now);
}

describe("SM-2 intervals", () => {
  it("shows the classic new-card buttons", () => {
    const preview = previewDelays(createInitialSrs(noon));
    expect(formatDelay(preview.again)).toBe("< 1m");
    expect(formatDelay(preview.hard)).toBe("~12h");
    expect(formatDelay(preview.good)).toBe("1d");
    expect(formatDelay(preview.easy)).toBe("4d");
  });

  it("schedules Good as 1d, then 6d, then interval times ease", () => {
    let card = createInitialSrs(noon);
    card = rate(card, "good", noon);
    expect(card.interval).toBe(1);
    expect(card.repetitions).toBe(1);
    expect(card.easeFactor).toBe(2.5);
    expect(card.status).toBe("review");

    card = rate(card, "good", noon);
    expect(card.interval).toBe(6);
    expect(card.repetitions).toBe(2);

    card = rate(card, "good", noon);
    expect(card.interval).toBe(15);
    expect(card.repetitions).toBe(3);
    expect(card.status).toBe("review");

    card = rate(card, "good", noon);
    expect(card.interval).toBe(37.5);
    expect(card.status).toBe("mastered");
  });

  it("boosts ease on Easy and floors at 4 days", () => {
    const card = rate(createInitialSrs(noon), "easy", noon);
    expect(card.easeFactor).toBe(2.65);
    expect(card.interval).toBe(4);
    expect(card.repetitions).toBe(1);
    expect(formatDelay(previewDelays(card).easy)).toBe("14d");
  });

  it("shortens Hard with 1.2x after the card is in review", () => {
    let card = createInitialSrs(noon);
    card = rate(card, "good", noon);
    card = rate(card, "good", noon);
    card = rate(card, "good", noon);
    expect(card.interval).toBe(15);
    card = rate(card, "hard", noon);
    expect(card.interval).toBe(18);
    expect(card.easeFactor).toBe(2.35);
    expect(card.repetitions).toBe(3);
  });

  it("resets on Again, drops ease, and never goes below 1.3", () => {
    let card = rate(createInitialSrs(noon), "again", noon);
    expect(card.repetitions).toBe(0);
    expect(card.interval).toBe(0);
    expect(card.easeFactor).toBe(2.3);
    expect(card.lapses).toBe(1);
    expect(card.status).toBe("learning");
    expect(card.dueDate - noon).toBe(60_000);

    for (let lapse = 0; lapse < 12; lapse += 1) card = rate(card, "again", noon);
    expect(card.easeFactor).toBe(1.3);
    expect(card.lapses).toBe(13);
  });

  it("suggests Easy or Good for a clean recall and Again after repeated slips", () => {
    const fresh = createInitialSrs(noon);
    expect(suggestedRating(0, fresh)).toBe("good");
    const familiar = { ...fresh, repetitions: 2 };
    expect(suggestedRating(0, familiar)).toBe("easy");
    expect(suggestedRating(1, fresh)).toBe("hard");
    expect(suggestedRating(2, fresh)).toBe("again");
  });
});

describe("streak and session queue", () => {
  it("continues a streak only from yesterday", () => {
    const started = updateStreak({ count: 0, lastDate: null }, noon);
    expect(started).toEqual({ count: 1, lastDate: "2026-01-15" });
    const sameDay = updateStreak(started, noon + 60_000);
    expect(sameDay.count).toBe(1);
    const tomorrow = updateStreak(started, new Date(2026, 0, 16, 12).getTime());
    expect(tomorrow.count).toBe(2);
    expect(visibleStreak(started, new Date(2026, 0, 17, 12).getTime())).toBe(0);
    expect(visibleStreak(tomorrow, new Date(2026, 0, 16, 12).getTime())).toBe(2);
  });

  it("keeps learning and due cards ahead of the daily new-card cap", () => {
    const lines: OpeningLine[] = ["a", "b", "c"].map((id) => ({
      id,
      eco: "C50",
      deck: "white-e4",
      name: id,
      variation: id,
      playerColor: "w",
      moves: ["e4", "e5"],
      moveExplanations: ["Idea. Play e4."],
      summaryPlan: "Develop and castle before creating a weakness in the center.",
    }));
    const srs = {
      a: { ...createInitialSrs(noon), status: "learning" as const, dueDate: noon - 1000, lastReviewed: noon },
      b: {
        ...createInitialSrs(noon),
        status: "review" as const,
        interval: 6,
        repetitions: 2,
        dueDate: noon + 86_400_000,
        lastReviewed: noon,
      },
      c: createInitialSrs(noon),
    };
    const queued = sessionLines("white-e4", lines, srs, [], 10, noon).map((line) => line.id);
    expect(queued).toEqual(["a", "c"]);
  });
});
