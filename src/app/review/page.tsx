"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/AppShell";
import { ReviewSession } from "@/components/ReviewSession";
import { useTrainer } from "@/context/TrainerContext";
import type { SessionDeck } from "@/types";

const DECKS = new Set(["all", "weak", "white-e4", "white-d4", "black-e4", "black-d4", "custom"]);

function ReviewInner() {
  const params = useSearchParams();
  const { ready } = useTrainer();
  const requested = params.get("deck") ?? "all";
  const deck = (DECKS.has(requested) ? requested : "all") as SessionDeck;
  if (!ready) return <LoadingScreen />;
  return <ReviewSession key={deck} deck={deck} />;
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ReviewInner />
    </Suspense>
  );
}
