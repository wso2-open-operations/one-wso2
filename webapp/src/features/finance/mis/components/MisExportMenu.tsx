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

import { useState, type MouseEvent } from "react";
import { Button, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, DownloadIcon, FileSpreadsheetIcon, FileTextIcon, FileIcon } from "@wso2/oxygen-ui-icons-react";
import { misWorkbookCsv } from "../export/misCsv";
import { saveMisPdf, type MisPdfHeading } from "../export/misPdf";
import { saveMisWorkbook, type MisWorkbookSpec } from "../export/misWorkbook";
import { saveBlob } from "@utils/saveFile";
import type { MisScale } from "../util/misViewVocabulary";
import { MIS_SCALES } from "../util/misViewVocabulary";
import { faithfulExportSx } from "./misLookTokens";

// ONE filled-primary "Export ▾" menu offering CSV · Excel · PDF, at every
// export point on the ARR Dashboard and in its dialogs.
//
// All three read the same workbook, so the file cannot disagree with the
// screen about which rows and Periods went out. Excel keeps the raw numbers
// with number formats; CSV keeps the raw numbers as text a spreadsheet can
// sum; the PDF prints the table as it was seen, Scale applied.
//
// Every item runs through `run`, so a failure in any of the three says so in
// the same note rather than vanishing into the console.

export default function MisExportMenu({
  workbook,
  filename,
  scale = MIS_SCALES.UNITS,
  heading,
  repeatColumns = 1,
}: {
  /** The workbook Excel and CSV write, and the table the PDF formats. */
  workbook: () => MisWorkbookSpec;
  /** The `.xlsx` name from `misExportFilename`; each item swaps the extension. */
  filename: () => string;
  /** How the PDF shows currency. Excel and CSV ignore it and keep the raw numbers. */
  scale?: MisScale;
  /** Title, Period, filters and the Pacific date, printed above the PDF table. */
  heading?: () => Omit<MisPdfHeading, "scale" | "repeatColumns">;
  /** Identity columns repeated when the PDF breaks across pages. */
  repeatColumns?: number;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");

  const close = () => setAnchor(null);
  const base = () => filename().replace(/\.xlsx$/i, "");

  /** Close the menu, write one file, and say so if that failed. */
  const run = async (write: () => Promise<void> | void) => {
    close();
    setNote("");
    setWorking(true);
    try {
      // One tick, so the menu is gone and the button reads "Exporting…" before
      // a large workbook is built.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await write();
    } catch {
      setNote("Couldn't write the file.");
    } finally {
      setWorking(false);
    }
  };

  const csv = () =>
    run(() => {
      const text = misWorkbookCsv(workbook());
      saveBlob(new Blob([text], { type: "text/csv;charset=utf-8" }), `${base()}.csv`);
    });

  const excel = () => run(() => saveMisWorkbook(workbook(), `${base()}.xlsx`));

  const pdf = () =>
    run(() => {
      const described = heading?.() ?? { title: base(), lines: [] };
      return saveMisPdf(workbook(), { ...described, scale, repeatColumns }, `${base()}.pdf`);
    });

  return (
    <>
      {note && (
        <Typography variant="caption" color="text.secondary" role="status" sx={{ mr: 1 }}>
          {note}
        </Typography>
      )}
      <Button
        size="small"
        variant="contained"
        disabled={working}
        startIcon={<DownloadIcon size={14} />}
        endIcon={<ChevronDownIcon size={14} />}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
        sx={faithfulExportSx}
      >
        {working ? "Exporting…" : "Export"}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        <MenuItem onClick={csv}>
          <ListItemIcon><FileTextIcon size={16} /></ListItemIcon>
          <ListItemText primary="CSV" secondary="raw numbers, same columns" />
        </MenuItem>
        <MenuItem onClick={excel}>
          <ListItemIcon><FileSpreadsheetIcon size={16} /></ListItemIcon>
          <ListItemText primary="Excel" secondary="raw numbers with number formats" />
        </MenuItem>
        <MenuItem onClick={pdf}>
          <ListItemIcon><FileIcon size={16} /></ListItemIcon>
          <ListItemText primary="PDF" secondary="as seen, landscape A4" />
        </MenuItem>
      </Menu>
    </>
  );
}
