"use client";

import { useEffect, useState } from "react";

// Autopilot drives the REAL pages (real forms, real handlers, real Gemini calls)
// when the URL carries ?autopilot=1. Nothing is faked; it just clicks and types
// for you so the whole product self-plays for a screen recording.

export function useAutopilot(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOn(new URLSearchParams(window.location.search).get("autopilot") === "1");
  }, []);
  return on;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// Type text into a controlled input by pushing state one character at a time,
// so it looks like a real person typing.
export function typeInto(
  setter: (v: string) => void,
  text: string,
  cps = 26,
): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      i += 1;
      setter(text.slice(0, i));
      if (i >= text.length) return resolve();
      setTimeout(step, 1000 / cps + Math.random() * 26);
    };
    setTimeout(step, 160);
  });
}
