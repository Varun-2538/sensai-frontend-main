"use client";

import { useEffect, useRef } from "react";

/**
 * Filters out benign Mediapipe INFO messages that are routed through console.error in dev,
 * such as "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." which pollute the console.
 */
export default function ConsoleErrorFilter() {
  const originalConsoleError = useRef<typeof console.error>();

  useEffect(() => {
    originalConsoleError.current = console.error;

    const ignorePatterns: RegExp[] = [
      /INFO:\s*Created TensorFlow Lite XNNPACK delegate for CPU/i,
      // Keep this narrowly scoped to Mediapipe INFO spam
      /@mediapipe\/tasks-vision/i,
    ];

    const shouldIgnore = (args: unknown[]): boolean => {
      try {
        for (const arg of args) {
          const text = typeof arg === "string" ? arg : arg instanceof Error ? arg.message : "";
          if (!text) continue;
          if (ignorePatterns.some((p) => p.test(text))) return true;
        }
      } catch {
        // fall through
      }
      return false;
    };

    console.error = (...args: any[]) => {
      if (shouldIgnore(args)) return;
      return originalConsoleError.current!(...args);
    };

    return () => {
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current;
      }
    };
  }, []);

  return null;
}


