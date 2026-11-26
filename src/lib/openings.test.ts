import { describe, expect, it } from "vitest";
import { OPENINGS } from "@/data/openings";
import { playerMoveCount, replayLine } from "@/lib/lines";
import type { DeckId } from "@/types";

const FAMILIES = [
  "Giuoco Piano",
  "Evans Gambit",
  "Fried Liver",
  "Morphy",
  "Berlin",
  "Scotch",
  "Vienna Gambit",
  "King's Gambit",
  "Accepted",
  "Slav",
  "London",
  "English",
  "Najdorf",
  "Dragon",
  "Alapin",
  "Winawer",
  "Caro-Kann",
  "Petrov",
  "Scandinavian",
  "King's Indian",
  "Nimzo",
  "Grünfeld",
  "Dutch",
  "Queen's Indian",
];

describe("opening book", () => {
  it("contains a broad 1200-to-1600 repertoire", () => {
    expect(OPENINGS.length).toBeGreaterThanOrEqual(35);
    const blob = OPENINGS.map((line) => `${line.name} ${line.variation}`).join(" | ");
    for (const family of FAMILIES) expect(blob).toContain(family);
    for (const deck of ["white-e4", "white-d4", "black-e4", "black-d4"] as DeckId[]) {
      expect(OPENINGS.filter((line) => line.deck === deck).length).toBeGreaterThanOrEqual(5);
    }
    expect(new Set(OPENINGS.map((line) => line.id)).size).toBe(OPENINGS.length);
  });

  it("replays every line and keeps one coach note per move you must find", () => {
    const square = /(?:^|[^a-zA-Z])[a-h][1-8](?![a-zA-Z])/;
    for (const line of OPENINGS) {
      expect(line.eco).toMatch(/^[A-E]\d{2}$/);
      expect(line.summaryPlan.length).toBeGreaterThan(40);
      expect(line.moves.length).toBeGreaterThanOrEqual(6);
      expect(line.moves.length).toBeLessThanOrEqual(12);
      const replay = replayLine(line.moves);
      if (!replay.ok) throw new Error(`${line.id}: ${replay.error}`);
      replay.moves.forEach((move, index) => {
        expect(move.san, `${line.id} ply ${index + 1}`).toBe(line.moves[index]);
      });
      expect(line.moveExplanations).toHaveLength(playerMoveCount(line.moves, line.playerColor));
      for (const note of line.moveExplanations) {
        const [idea, ...rest] = note.split(/(?<=\.)\s+/);
        expect(rest.length, `${line.id} note`).toBeGreaterThan(0);
        expect(idea, `${line.id} hint`).not.toMatch(square);
      }
    }
  });
});
