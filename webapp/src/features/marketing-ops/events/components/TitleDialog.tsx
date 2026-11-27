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

import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Check, X } from "@wso2/oxygen-ui-icons-react";
import type { PendingTitle } from "../rules/model";
import { titleKey } from "../rules/titles";
import { primaryBtn, quietBtn } from "./eventsStyles";

// Job titles not in English, one at a time.
//
// Accepting a whole column of translations in one click took the model's word for
// every one of them, unread. Here each distinct title is shown with its suggestion and
// answered on its own — the English, or your own English — and the next one comes up.
// There is no keeping a title as it is: every title goes to Salesforce in English. One
// answer covers every row with that title, so "Directeur Technique" on four rows is
// asked once.

/** Salesforce's Lead.Title is 128 characters. */
const TITLE_LIMIT = 128;

export default function TitleDialog({
  open,
  pending,
  onAnswer,
  onClose,
}: {
  open: boolean;
  /** What is still unanswered, live — an answered title drops out, which is how the
   *  dialog moves on. */
  pending: PendingTitle[];
  onAnswer: (key: string, answer: string) => void;
  onClose: () => void;
}) {
  // Skipping moves past a title without answering it; it comes round again at the end.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [custom, setCustom] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);

  if (!open) return null;

  const order = [
    ...pending.filter((p) => !skipped.includes(p.key)),
    ...skipped.map((k) => pending.find((p) => p.key === k)).filter((p): p is PendingTitle => !!p),
  ];
  const current = order[0];

  const answer = (value: string) => {
    if (!current) return;
    onAnswer(current.key, value);
    setSkipped((s) => s.filter((k) => k !== current.key));
    setCustom(null);
    setAnswered((n) => n + 1);
  };
  const close = () => {
    setSkipped([]);
    setCustom(null);
    setAnswered(0);
    onClose();
  };

  const own = custom?.trim() ?? "";
  const ownError =
    own.length > TITLE_LIMIT
      ? `Salesforce keeps ${TITLE_LIMIT} characters at most.`
      : current && own && titleKey(own) === current.key
        ? "That's the title as it is. Write it in English."
        : "";

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        Job titles not in English
        {/* Closing answers nothing: whatever is left stays flagged, and reopening picks up
            where the list stands. */}
        <Tooltip title="Close — anything not answered stays flagged" arrow>
          <IconButton
            size="small"
            onClick={close}
            aria-label="Close"
            sx={{ ml: "auto", mr: -1, color: "text.secondary", "&:hover": { color: "text.primary" } }}
          >
            <X size={18} />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <DialogContent>
        {!current ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
            <Box sx={{ color: "success.main", display: "inline-flex" }}>
              <Check size={18} />
            </Box>
            <Typography sx={{ fontSize: 14 }}>
              {answered
                ? `Done — ${answered} ${answered === 1 ? "title" : "titles"} answered. Every job title is settled.`
                : "Every job title is settled."}
            </Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 2 }}>
              {order.length} {order.length === 1 ? "title" : "titles"} left · each answer applies to every row
              with that title, on every tab
            </Typography>

            <Typography sx={LABEL_SX}>
              In the list{current.language ? ` · ${current.language}` : ""} · {current.rows}{" "}
              {current.rows === 1 ? "row" : "rows"}
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 2, wordBreak: "break-word" }}>
              {current.title}
            </Typography>

            <Typography sx={LABEL_SX}>Suggested English</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: "success.main", mb: 2, wordBreak: "break-word" }}>
              {current.english}
            </Typography>

            {custom !== null && (
              <>
                <Typography sx={LABEL_SX}>Your own</Typography>
                <TextField
                  fullWidth
                  size="small"
                  autoFocus
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  inputProps={{ "aria-label": "Your own English title" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && own && !ownError) answer(own);
                  }}
                  error={!!ownError}
                  helperText={ownError || " "}
                />
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
        {!current ? (
          <Button variant="contained" sx={primaryBtn} onClick={close}>
            Close
          </Button>
        ) : custom !== null ? (
          <>
            <Button sx={quietBtn} onClick={() => setCustom(null)}>
              Back
            </Button>
            <Button variant="contained" sx={primaryBtn} disabled={!own || !!ownError} onClick={() => answer(own)}>
              Use this title
            </Button>
          </>
        ) : (
          <>
            {order.length > 1 && (
              <Button sx={{ ...quietBtn, mr: "auto" }} onClick={() => setSkipped((s) => [...s.filter((k) => k !== current.key), current.key])}
              >
                Skip for now
              </Button>
            )}
            <Button sx={quietBtn} onClick={() => setCustom(current.english)}>
              Write my own
            </Button>
            <Button variant="contained" sx={primaryBtn} onClick={() => answer(current.english)}>
              Use the English
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

const LABEL_SX = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "text.disabled",
  mb: 0.6,
};
