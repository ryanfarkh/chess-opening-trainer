export type Color = "w" | "b";

export type DeckId = "white-e4" | "white-d4" | "black-e4" | "black-d4" | "custom";

export type SessionDeck = DeckId | "all" | "weak";

export type CardStatus = "new" | "learning" | "review" | "mastered";

export type Rating = "again" | "hard" | "good" | "easy";

export interface OpeningLine {
  id: string;
  eco: string;
  deck: DeckId;
  name: string;
  variation: string;
  playerColor: Color;
  moves: string[];
  moveExplanations: string[];
  summaryPlan: string;
  custom?: boolean;
}

export interface SrsState {
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: number;
  status: CardStatus;
  lapses: number;
  lastReviewed: number | null;
}

export interface Settings {
  blindRecall: boolean;
  showArrows: boolean;
  newPerDay: number;
}

export interface Streak {
  count: number;
  lastDate: string | null;
}

export interface PersistedState {
  version: 1;
  srs: Record<string, SrsState>;
  customLines: OpeningLine[];
  streak: Streak;
  reviewsByDay: Record<string, number>;
  introducedByDay: Record<string, string[]>;
  settings: Settings;
}
