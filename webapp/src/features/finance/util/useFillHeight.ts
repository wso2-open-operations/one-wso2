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
// under the License.

import { useEffect, useRef, useState } from "react";

/** Never shrink below this, however little room the window leaves. */
const MIN_FILL_HEIGHT = 420;

/**
 * How tall an element may grow: everything between its top edge and the bottom
 * of the area the page is drawn in. Give the returned height to a card that
 * should reach the bottom of the page exactly — no gap under it, and no
 * scrollbar from asking for more room than the page has.
 *
 * Measured rather than a `calc(100vh - …)`, following `AttendeeGrid`: the page
 * does not own the whole viewport (AppLayout keeps the top bar and footer
 * outside its scroller), and what sits above the card MOVES — the subtitle
 * wraps when the sidebar collapses, and an action row may only exist once
 * there is something to act on. Every guessed constant was wrong in one of
 * those states, either leaving a gap under the card or bringing back a
 * scrollbar.
 *
 * @param watch re-measures when this changes. For the things that move the
 * element but leave every box above it the same SIZE — chiefly a row that
 * appears conditionally — a resize observer never fires, because nothing
 * resized; the element merely gained a sibling.
 */
export function useFillHeight<T extends HTMLElement>(watch?: unknown) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(Math.max(MIN_FILL_HEIGHT, availableBelow(el)));
    measure();
    window.addEventListener("resize", measure);
    // Watch the SCROLLER, not `document.body`: AppLayout pins the shell to
    // `100dvh` with `overflow: hidden`, so the body's box never changes size
    // and an observer on it would never fire once.
    //
    // Absent in jsdom, so the observer is optional; the mount measurement, the
    // resize listener and `watch` still give the right answer without it.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const scroller = scrollParent(el);
    if (scroller) observer?.observe(scroller);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [watch]);

  return [ref, height] as const;
}

/** Nearest ancestor that scrolls, or null if nothing above this one does. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * Room left between an element's top edge and the bottom of whatever scrolls
 * it. The scroller's own bottom padding is left free, so the element stops
 * where every other page's content stops.
 *
 * The offset is taken within the scroller's CONTENT, not the viewport. A
 * viewport-relative top shrinks as the page scrolls, so the element would be
 * told it had more room the further down you went — growing, pushing the page
 * longer, and feeding its own scrollbar.
 */
function availableBelow(el: HTMLElement): number {
  const top = el.getBoundingClientRect().top;
  const scroller = scrollParent(el);
  if (!scroller) return window.innerHeight - (top + window.scrollY);
  const paddingBottom = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
  const offsetInContent = top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  return scroller.clientHeight - paddingBottom - offsetInContent;
}
