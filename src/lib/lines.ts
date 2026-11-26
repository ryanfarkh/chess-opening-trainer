import { Chess, type Square } from "chess.js";
import type { Color, OpeningLine } from "@/types";

export interface PlayedMove {
  san: string;
  from: string;
  to: string;
  color: Color;
  fen: string;
}

export interface ReplayedLine {
  ok: true;
  positions: string[];
  moves: PlayedMove[];
  turn: Color;
}

export function startFen(): string {
  return new Chess().fen();
}

export function sideFromFen(fen: string): Color {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export function replayLine(moves: string[]): ReplayedLine | { ok: false; error: string } {
  const chess = new Chess();
  const positions = [chess.fen()];
  const played: PlayedMove[] = [];

  for (const san of moves) {
    try {
      const result = chess.move(san);
      if (!result) return { ok: false, error: `${san}: illegal` };
      const fen = chess.fen();
      positions.push(fen);
      played.push({
        san: result.san,
        from: result.from,
        to: result.to,
        color: result.color,
        fen,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "illegal";
      return { ok: false, error: `${san}: ${message}` };
    }
  }

  return { ok: true, positions, moves: played, turn: chess.turn() };
}

export function playUserMove(
  fen: string,
  from: string,
  to: string,
): { fen: string; san: string; from: string; to: string } | null {
  try {
    const chess = new Chess(fen);
    const result = chess.move({ from: from as Square, to: to as Square, promotion: "q" });
    if (!result) return null;
    return { fen: chess.fen(), san: result.san, from: result.from, to: result.to };
  } catch {
    return null;
  }
}

export function playerMoveCount(moves: string[], color: Color): number {
  return moves.filter((_, index) => (index % 2 === 0 ? "w" : "b") === color).length;
}

export function explanationAt(line: OpeningLine, plyCursor: number): string {
  const colorToMove: Color = plyCursor % 2 === 0 ? "w" : "b";
  if (colorToMove !== line.playerColor) return line.summaryPlan;
  let index = 0;
  for (let ply = 0; ply < plyCursor; ply += 1) {
    const color: Color = ply % 2 === 0 ? "w" : "b";
    if (color === line.playerColor) index += 1;
  }
  return line.moveExplanations[index] ?? line.summaryPlan;
}

export function coachSentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function hintText(explanation: string, moveMistakes: number, san: string): string | null {
  if (moveMistakes <= 0) return null;
  const parts = coachSentences(explanation);
  const idea = parts[0] ?? explanation;
  if (moveMistakes === 1) return idea;
  const rest = parts.slice(1).join(" ");
  if (!rest) return `${idea} The move is ${san}.`;
  if (rest.includes(san)) return `${idea} ${rest}`;
  return `${idea} ${rest} The move is ${san}.`;
}

export function motionDelay(): number {
  if (typeof window === "undefined") return 0;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260;
}
