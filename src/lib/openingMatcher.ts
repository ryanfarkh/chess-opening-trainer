import { Chess } from "chess.js";
import type { Color, OpeningLine } from "@/types";
import { coachSentences, replayLine } from "@/lib/lines";

export const MAIN_ARROW = "#059669";
export const ALT_ARROW = "#2563eb";

export interface BoardArrow {
  startSquare: string;
  endSquare: string;
  color: string;
  san: string;
}

export interface OpeningIdentification {
  matched: boolean;
  eco: string;
  name: string;
  variation: string;
  explanation: string;
  summary: string | null;
  ply: number;
  arrows: BoardArrow[];
  mainSan: string | null;
  lineId: string | null;
}

interface Hit {
  line: OpeningLine;
  ply: number;
  nextSan: string | null;
  explanation: string | null;
}

export function normalizeFen(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function explanationForNext(line: OpeningLine, ply: number, nextSan: string | null): string | null {
  if (!nextSan) return null;
  const colorToMove: Color = ply % 2 === 0 ? "w" : "b";
  if (colorToMove !== line.playerColor) return null;
  let index = 0;
  for (let cursor = 0; cursor < ply; cursor += 1) {
    const color: Color = cursor % 2 === 0 ? "w" : "b";
    if (color === line.playerColor) index += 1;
  }
  return line.moveExplanations[index] ?? null;
}

export function createOpeningIndex(lines: OpeningLine[]): Map<string, Hit[]> {
  const index = new Map<string, Hit[]>();
  for (const line of lines) {
    const replay = replayLine(line.moves);
    if (!replay.ok) continue;
    replay.positions.forEach((fen, ply) => {
      const nextSan = line.moves[ply] ?? null;
      const hit: Hit = {
        line,
        ply,
        nextSan,
        explanation: explanationForNext(line, ply, nextSan),
      };
      const key = normalizeFen(fen);
      const bucket = index.get(key);
      if (bucket) bucket.push(hit);
      else index.set(key, [hit]);
    });
  }
  return index;
}

function moveSquares(line: OpeningLine, ply: number, san: string): { from: string; to: string } | null {
  try {
    const chess = new Chess();
    for (let index = 0; index < ply; index += 1) {
      const played = chess.move(line.moves[index]);
      if (!played) return null;
    }
    const next = chess.move(san);
    if (!next) return null;
    return { from: next.from, to: next.to };
  } catch {
    return null;
  }
}

function uniqueLabel(values: string[]): string {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return "Repertoire";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} or ${unique[1]}`;
  return `${unique[0]}, ${unique[1]} +${unique.length - 2}`;
}

const OUT_OF_BOOK: OpeningIdentification = {
  matched: false,
  eco: "—",
  name: "Out of book",
  variation: "No repertoire line",
  explanation:
    "This position is outside your deck. Develop your pieces, fight for the center, and keep the king safe.",
  summary: null,
  ply: 0,
  arrows: [],
  mainSan: null,
  lineId: null,
};

export function identifyPosition(fen: string, index: Map<string, Hit[]>): OpeningIdentification {
  const hits = index.get(normalizeFen(fen));
  if (!hits || hits.length === 0) return OUT_OF_BOOK;

  const side: Color = fen.split(" ")[1] === "b" ? "b" : "w";
  const continuing = hits.filter((hit) => hit.nextSan);
  const sideHits = continuing.filter((hit) => hit.line.playerColor === side);
  const pool = sideHits.length > 0 ? sideHits : continuing;

  const groups = new Map<string, Hit[]>();
  for (const hit of pool) {
    if (!hit.nextSan) continue;
    const group = groups.get(hit.nextSan);
    if (group) group.push(hit);
    else groups.set(hit.nextSan, [hit]);
  }

  const ranked = [...groups.entries()].sort((a, b) => {
    const lengthScore = b[1].length - a[1].length;
    if (lengthScore !== 0) return lengthScore;
    const remain = (hitsForSan: Hit[]) =>
      Math.max(...hitsForSan.map((hit) => hit.line.moves.length - hit.ply));
    return remain(b[1]) - remain(a[1]);
  });

  const arrows: BoardArrow[] = [];
  for (const [san, group] of ranked.slice(0, 4)) {
    const source = group[0];
    const squares = moveSquares(source.line, source.ply, san);
    if (!squares) continue;
    arrows.push({
      startSquare: squares.from,
      endSquare: squares.to,
      color: arrows.length === 0 ? MAIN_ARROW : ALT_ARROW,
      san,
    });
  }

  const mainGroup = ranked[0]?.[1] ?? [];
  const mainHit =
    mainGroup.find((hit) => hit.explanation) ??
    mainGroup[0] ??
    hits.reduce((best, hit) => (hit.ply > best.ply ? hit : best), hits[0]);

  const uniqueIds = new Set(hits.map((hit) => hit.line.id));
  const atStart = hits.every((hit) => hit.ply === 0);
  const idea = mainHit.explanation ?? mainHit.line.summaryPlan;
  const explanation = atStart
    ? "Choose a first move from your repertoire. The green arrow is the most common weapon in the deck, and the blue arrows are the other book choices."
    : idea;

  const name = atStart ? "Starting Position" : uniqueLabel(hits.map((hit) => hit.line.name));
  const variation = atStart
    ? "Repertoire roots"
    : uniqueLabel((mainGroup.length > 0 ? mainGroup : [mainHit]).map((hit) => hit.line.variation));

  return {
    matched: true,
    eco: atStart ? "—" : uniqueLabel((mainGroup.length > 0 ? mainGroup : [mainHit]).map((hit) => hit.line.eco)),
    name,
    variation,
    explanation,
    summary: uniqueIds.size === 1 ? mainHit.line.summaryPlan : null,
    ply: mainHit.ply,
    arrows,
    mainSan: arrows[0]?.san ?? null,
    lineId: uniqueIds.size === 1 ? mainHit.line.id : mainHit.line.id,
  };
}

export function visibleCoachText(identification: OpeningIdentification, showArrows: boolean): string {
  if (showArrows || !identification.matched) return identification.explanation;
  return coachSentences(identification.explanation)[0] ?? identification.explanation;
}
