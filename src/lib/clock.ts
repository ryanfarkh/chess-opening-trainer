"use client";

import { useSyncExternalStore } from "react";

let clock = 0;
const listeners = new Set<() => void>();
let timer = 0;

function ensureClock() {
  if (typeof window === "undefined") return;
  if (clock === 0) clock = Date.now();
  if (timer) return;
  timer = window.setInterval(() => {
    clock = Date.now();
    listeners.forEach((listener) => listener());
  }, 30_000);
}

export function useNow() {
  return useSyncExternalStore(
    (listener) => {
      ensureClock();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => {
      ensureClock();
      return clock;
    },
    () => 0,
  );
}
