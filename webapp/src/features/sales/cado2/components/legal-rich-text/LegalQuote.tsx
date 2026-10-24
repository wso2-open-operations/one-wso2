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

import { useLayoutEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { Box, Button } from "@wso2/oxygen-ui";

// About four lines of body text.
const PREVIEW_HEIGHT = "6.9em";

/**
 * Legal text quoted as it prints (2026-10-24): a bar down the left, so it
 * reads as the document, apart from CadO2's own labels and switches around
 * it. A long text opens as a preview; "Show full text" opens the rest.
 */
export default function LegalQuote({ children }: { children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    // Measured while closed; open, it stays long so "Show less" stays.
    if (!el || open) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  const quote = <Box sx={{ borderLeft: 3, borderColor: "divider", pl: 2, py: 0.25 }}>{children}</Box>;

  return (
    <Box>
      <Box
        ref={ref}
        sx={{
          position: "relative",
          overflow: "hidden",
          maxHeight: open ? "none" : PREVIEW_HEIGHT,
          ...(!open && long
            ? {
                "&::after": {
                  content: '""',
                  position: "absolute",
                  insetInline: 0,
                  bottom: 0,
                  height: "2.6em",
                  pointerEvents: "none",
                  background: (t) => `linear-gradient(to bottom, transparent, ${t.palette.background.paper})`,
                },
              }
            : {}),
        }}
      >
        {quote}
      </Box>
      {long ? (
        <Button size="small" variant="text" onClick={() => setOpen((o) => !o)} aria-expanded={open} sx={{ ml: 2.375, mt: 0.25, px: 0, minWidth: 0 }}>
          {open ? "Show less" : "Show full text"}
        </Button>
      ) : null}
    </Box>
  );
}
