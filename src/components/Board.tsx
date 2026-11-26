"use client";

import { Chess, type Square } from "chess.js";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Color } from "@/types";

const Chessboard = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard), {
  ssr: false,
});

export interface TrainerArrow {
  startSquare: string;
  endSquare: string;
  color: string;
}

interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  interactive: boolean;
  turn: Color | "both";
  arrows?: TrainerArrow[];
  lastMove?: { from: string; to: string } | null;
  wrongSquare?: string | null;
  shakeKey?: number;
  onMove: (from: string, to: string) => boolean;
}

function pieceOn(fen: string, square: string): { color: Color } | null {
  try {
    const piece = new Chess(fen).get(square as Square);
    return piece ? { color: piece.color } : null;
  } catch {
    return null;
  }
}

function destinations(fen: string, square: string): { square: string; capture: boolean }[] {
  try {
    return new Chess(fen).moves({ square: square as Square, verbose: true }).map((move) => ({
      square: move.to,
      capture: Boolean(move.captured),
    }));
  } catch {
    return [];
  }
}

export function Board({
  fen,
  orientation,
  interactive,
  turn,
  arrows = [],
  lastMove,
  wrongSquare,
  shakeKey = 0,
  onMove,
}: BoardProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lastAction = useRef(0);
  const [size, setSize] = useState(280);
  const [selection, setSelection] = useState<{ fen: string; square: string } | null>(null);
  const selected = selection?.fen === fen ? selection.square : null;

  useEffect(() => {
    const element = slotRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = Math.floor(Math.min(rect.width, rect.height));
      if (next > 40) setSize(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = boardRef.current;
    if (!element || shakeKey === 0) return;
    element.classList.remove("board-shake");
    void element.offsetWidth;
    element.classList.add("board-shake");
  }, [shakeKey]);

  const ownPiece = (square: string) => {
    const piece = pieceOn(fen, square);
    if (!piece) return false;
    return turn === "both" || turn === piece.color;
  };

  const choose = (square: string) => {
    if (!interactive) return;
    const now = Date.now();
    if (now - lastAction.current < 40) return;
    lastAction.current = now;

    if (selected) {
      if (square === selected || ownPiece(square)) {
        setSelection(square === selected ? null : { fen, square });
        return;
      }
      onMove(selected, square);
      setSelection(null);
      return;
    }
    if (ownPiece(square)) setSelection({ fen, square });
  };

  const targets = selected && interactive ? destinations(fen, selected) : [];
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: "rgba(255, 230, 90, 0.35)" };
    squareStyles[lastMove.to] = { backgroundColor: "rgba(255, 230, 90, 0.45)" };
  }
  if (selected) squareStyles[selected] = { backgroundColor: "rgba(250, 204, 21, 0.55)" };
  for (const target of targets) {
    squareStyles[target.square] = target.capture
      ? { boxShadow: "inset 0 0 0 4px rgba(20, 20, 20, 0.45)" }
      : { backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.38) 20%, transparent 22%)" };
  }
  if (wrongSquare) squareStyles[wrongSquare] = { backgroundColor: "rgba(220, 38, 38, 0.92)" };

  return (
    <div ref={slotRef} className="board-slot h-full w-full">
      <div ref={boardRef} style={{ width: size, height: size }}>
        <Chessboard
          options={{
            id: "trainer-board",
            position: fen,
            boardOrientation: orientation,
            allowDragging: interactive,
            allowDrawingArrows: false,
            animationDurationInMs: 180,
            arrows: arrows.map(({ startSquare, endSquare, color }) => ({ startSquare, endSquare, color })),
            squareStyles,
            darkSquareStyle: { backgroundColor: "#769656" },
            lightSquareStyle: { backgroundColor: "#eeeed2" },
            darkSquareNotationStyle: { color: "rgba(238,238,210,0.85)" },
            lightSquareNotationStyle: { color: "#3d5226" },
            dropSquareStyle: { boxShadow: "inset 0 0 0 3px rgba(5,150,105,0.9)" },
            canDragPiece: ({ piece }) => {
              if (!interactive) return false;
              const color: Color = piece.pieceType.startsWith("b") ? "b" : "w";
              return turn === "both" || turn === color;
            },
            onPieceClick: ({ square }) => {
              if (square) choose(square);
            },
            onSquareClick: ({ square }) => choose(square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!interactive || !targetSquare || targetSquare === sourceSquare) return false;
              setSelection(null);
              return onMove(sourceSquare, targetSquare);
            },
          }}
        />
      </div>
    </div>
  );
}
