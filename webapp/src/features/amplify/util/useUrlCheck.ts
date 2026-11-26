// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations

import { useCallback, useEffect, useRef, useState } from "react";

/** What a checker says about a value: usable, not usable, or it could not tell. */
export type UrlCheckVerdict = "ok" | "bad" | "unknown";

/** A verdict, optionally with a short reason the field shows under the box. */
export type UrlCheckResult = UrlCheckVerdict | { verdict: UrlCheckVerdict; message?: string };

/** Pluggable check. Gets the trimmed, non-empty value; abort the work when the signal fires. */
export type UrlChecker = (value: string, signal: AbortSignal) => Promise<UrlCheckResult>;

export type UrlCheckState = "idle" | "checking" | "ok" | "bad";

export interface UrlCheck {
  /** Where the check stands for the value in the box right now. */
  state: UrlCheckState;
  /** The checker's reason when state is "bad", if it gave one. */
  message?: string;
  /** Run the check for this value (call it when the box loses focus). */
  check: (value: string) => void;
}

interface Outcome {
  value: string;
  state: Exclude<UrlCheckState, "idle">;
  message?: string;
}

/**
 * Checks a text value with an injectable async checker. An empty value is idle (nothing
 * shown), "unknown" and a thrown checker are idle too (no false alarm), and editing the
 * value after a check puts the field back to idle until the next check.
 * `value` is the current text of the box; `initialValue` is checked once on mount.
 */
export function useUrlCheck(checker: UrlChecker, value: string, initialValue?: string): UrlCheck {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const checkerRef = useRef(checker);
  useEffect(() => {
    checkerRef.current = checker;
  }, [checker]);

  const check = useCallback((raw: string) => {
    const next = raw.trim();
    const id = ++run.current;
    abort.current?.abort();
    if (!next) {
      setOutcome(null);
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setOutcome({ value: next, state: "checking" });
    checkerRef.current(next, controller.signal).then(
      (result) => {
        if (id !== run.current) return;
        const verdict = typeof result === "string" ? result : result.verdict;
        const message = typeof result === "string" ? undefined : result.message;
        setOutcome(verdict === "unknown" ? null : { value: next, state: verdict, message });
      },
      () => {
        if (id === run.current) setOutcome(null);
      },
    );
  }, []);

  // The existing value gets checked when the form first comes up.
  useEffect(() => {
    if (initialValue?.trim()) check(initialValue);
    const pending = abort;
    const counter = run;
    return () => {
      counter.current += 1;
      pending.current?.abort();
    };
    // Mount only: the form is keyed per record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = !outcome || outcome.value !== value.trim();
  return stale ? { state: "idle", check } : { state: outcome.state, message: outcome.message, check };
}
