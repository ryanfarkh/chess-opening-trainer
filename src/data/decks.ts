import type { DeckId } from "@/types";

export const DECK_IDS: DeckId[] = [
  "white-e4",
  "white-d4",
  "black-e4",
  "black-d4",
  "custom",
];

export const DECKS: { id: DeckId; title: string; blurb: string }[] = [
  {
    id: "white-e4",
    title: "White: 1. e4 Repertoire",
    blurb: "Italian, Ruy Lopez, Scotch, Vienna, King's Gambit",
  },
  {
    id: "white-d4",
    title: "White: 1. d4 Repertoire",
    blurb: "Queen's Gambit, London, English",
  },
  {
    id: "black-e4",
    title: "Black vs 1. e4",
    blurb: "Sicilian, French, Caro-Kann, Petrov, Scandinavian",
  },
  {
    id: "black-d4",
    title: "Black vs 1. d4",
    blurb: "King's Indian, Nimzo, Grünfeld, Dutch",
  },
  {
    id: "custom",
    title: "My Lines",
    blurb: "Traps and ideas you saved from the board",
  },
];

export function deckTitle(id: string): string {
  if (id === "all") return "All Due Cards";
  if (id === "weak") return "Weakest Lines";
  return DECKS.find((deck) => deck.id === id)?.title ?? "Deck";
}
