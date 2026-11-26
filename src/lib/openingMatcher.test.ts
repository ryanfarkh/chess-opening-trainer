import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { OPENINGS } from "@/data/openings";
import { replayLine } from "@/lib/lines";
import {
  ALT_ARROW,
  MAIN_ARROW,
  createOpeningIndex,
  identifyPosition,
  normalizeFen,
} from "@/lib/openingMatcher";

const index = createOpeningIndex(OPENINGS);

describe("opening matcher", () => {
  it("recognizes a finished line and ignores move clocks", () => {
    const line = OPENINGS.find((item) => item.id === "italian-fried-liver");
    if (!line) throw new Error("missing fried liver");
    const replay = replayLine(line.moves);
    if (!replay.ok) throw new Error(replay.error);
    const exact = identifyPosition(replay.positions.at(-1) ?? "", index);
    expect(exact.variation).toContain("Fried Liver");
    expect(exact.eco).toBe("C57");
    expect(exact.arrows).toHaveLength(0);

    const parts = (replay.positions.at(-1) ?? "").split(" ");
    parts[4] = "9";
    parts[5] = "30";
    const shifted = identifyPosition(parts.join(" "), index);
    expect(normalizeFen(parts.join(" "))).toBe(normalizeFen(replay.positions.at(-1) ?? ""));
    expect(shifted.lineId).toBe(exact.lineId);
  });

  it("shows the repertoire choices after 1. e4 e5 2. Nf3 Nc6", () => {
    const chess = new Chess();
    for (const san of ["e4", "e5", "Nf3", "Nc6"]) chess.move(san);
    const found = identifyPosition(chess.fen(), index);
    expect(found.matched).toBe(true);
    expect(found.arrows.length).toBeGreaterThan(1);
    expect(found.arrows[0]?.color).toBe(MAIN_ARROW);
    expect(found.arrows.some((arrow) => arrow.color === ALT_ARROW)).toBe(true);
    const targets = found.arrows.map((arrow) => arrow.san);
    expect(targets).toContain("Bc4");
    expect(targets).toContain("Bb5");
  });

  it("coaches the side to move when both colors share a line", () => {
    const chess = new Chess();
    for (const san of ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3"]) chess.move(san);
    const found = identifyPosition(chess.fen(), index);
    expect(found.matched).toBe(true);
    expect(found.mainSan).toBe("O-O");
    expect(found.explanation.toLowerCase()).toContain("king");
  });
});
