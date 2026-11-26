"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const drilling = pathname.startsWith("/review");

  return (
    <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">{children}</div>
      {drilling ? <div className="pb-[env(safe-area-inset-bottom)]" /> : <BottomNav />}
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-full bg-emerald-400" />
    </div>
  );
}
