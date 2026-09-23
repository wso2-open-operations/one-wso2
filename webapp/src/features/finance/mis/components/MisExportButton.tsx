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

// The one control that takes a MIS table out of the browser.
//
// ADR 0004 makes an export required scope rather than a caveat: a hand-rolled
// `<table>` gets none of the select-and-paste a data grid gives free, and that
// paste is Finance's existing workflow.

import { useState } from "react";
import { Button, Menu, MenuItem, Stack, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, Download } from "@wso2/oxygen-ui-icons-react";
import { saveMisWorkbook, type MisWorkbookSpec } from "../export/misWorkbook";

/** One file this control can write. */
export interface MisExport {
  /**
   * The workbook to write, described when the reader asks for it.
   *
   * A whole SPEC rather than one sheet, because Flash is multi-sheet by
   * construction — `downloadExcel.js` writes an annual summary plus one sheet
   * per business unit.
   *
   * A thunk rather than a value: a per-customer Build is thousands of rows and
   * every one of them would be walked on every render of a screen whose export
   * is usually never clicked. And it may be ASYNC, because the Flash's Full
   * Report has to read all six units' monthly views before it has anything to
   * describe. A failed read rejects, and the reader is told.
   *
   * Both thunks are handed the SAME `instant`, taken at the click, so a sheet
   * that says when it was generated and the name it is saved under cannot
   * name two days — which a Full Report's reads could otherwise straddle.
   */
  workbook: (instant: Date) => MisWorkbookSpec | Promise<MisWorkbookSpec>;
  /** Likewise deferred — it carries the date. */
  filename: (instant: Date) => string;
}

/** One entry of a menu of exports — the Flash's "Full Report" and "Annual Report". */
export interface MisExportChoice extends MisExport {
  label: string;
}

/**
 * One export, or a menu of them.
 *
 * A menu rather than a second button because the source's Flash has exactly
 * that — one Export, with its two reports under it — and two controls both
 * reading "Export" beside one table would ask the reader to guess.
 */
export type MisExportButtonProps = MisExport | { choices: readonly MisExportChoice[] };

export default function MisExportButton(props: MisExportButtonProps) {
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const run = async ({ workbook, filename }: MisExport) => {
    setWorking(true);
    setFailed(false);
    try {
      // Yield once before describing the workbook. Walking a 3,000-row
      // customers table is synchronous and takes long enough to be seen, and
      // without this it happens in the same tick as the state above — so the
      // screen freezes with the button still reading "Export", which is the
      // moment a reader clicks it a second time.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const instant = new Date();
      await saveMisWorkbook(await workbook(instant), filename(instant));
    } catch {
      // Said on screen rather than only in the console. The work happens after
      // the click returns — reads, a dynamic import, then a zip — so a failure
      // is silent by default, and a reader who saw nothing happen would click
      // again rather than know.
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };

  // One of the two, narrowed once: a menu of reports, or the one export.
  const menu = "choices" in props ? props.choices : null;
  const single = "choices" in props ? null : props;

  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      {failed && (
        // Not "couldn't build": CONTEXT.md reserves Build for the roll-forward
        // this very screen is showing, and the sentence sits directly above one.
        <Typography variant="caption" color="error" role="alert">
          Couldn&apos;t write the file.
        </Typography>
      )}
      <Button
        size="small"
        variant="outlined"
        startIcon={<Download size={15} />}
        endIcon={menu ? <ChevronDownIcon size={15} /> : undefined}
        onClick={(event) => (single ? void run(single) : setAnchor(event.currentTarget))}
        disabled={working}
        aria-haspopup={menu ? "menu" : undefined}
        aria-expanded={menu && anchor ? true : undefined}
      >
        {working ? "Exporting…" : "Export"}
      </Button>
      {menu && (
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          {menu.map((choice) => (
            <MenuItem
              key={choice.label}
              onClick={() => {
                setAnchor(null);
                void run(choice);
              }}
            >
              {choice.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Stack>
  );
}
