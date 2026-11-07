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

import { useState, type JSX } from "react";
import { Alert, Box, Button, Link, Stack, Typography } from "@wso2/oxygen-ui";
import { CircleCheckIcon } from "@wso2/oxygen-ui-icons-react";
import type { LegalView } from "@features/sales/cado2/quotes/api/quoteTypes";
import { useWriteSpecialTerms } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { messageOf } from "@features/sales/cado2/quotes/api/errors";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import LegalRichTextField from "@features/sales/cado2/components/legal-rich-text/LegalRichTextField";
import LegalHtml from "@features/sales/cado2/components/legal-rich-text/LegalHtml";
import { cleanLegalText, sameLegalText } from "@features/sales/cado2/utils/legalRichText";

/** The name before the @: "priya". */
const shortName = (email: string | null | undefined) => (email ? email.split("@")[0] : "");

/**
 * Deal Desk's part of its approval (D139): the AM wrote the special terms;
 * Deal Desk checks them and may override them. Saved on the submitted
 * version (and in its history), no new version; the AM's text is kept. The
 * override pre-fills with the current text, so Deal Desk adjusts rather than
 * retypes; the AM's text again removes the override. Legal reviews the
 * special terms after Deal Desk approves, and may override them in turn.
 */
export default function SpecialTermsEditor({
  quoteId,
  versionNumber,
  legal,
  minHeight = 120,
}: {
  quoteId: number;
  versionNumber: number;
  /** The version's legal view: the AM's text and any override. */
  legal: LegalView | null;
  /** The editor's height; taller in the lens's own section (D129). */
  minHeight?: number;
}): JSX.Element {
  const write = useWriteSpecialTerms(quoteId, versionNumber);
  const notify = useCado2Toast();
  const amText = legal?.amSpecialTerms ?? null;
  const deskText = legal?.deskSpecialTerms ?? null;
  const current = deskText ?? amText ?? "";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(current);
  const [showAM, setShowAM] = useState(false);
  // Saved and not changed since: says so, in green, until the next edit.
  const [saved, setSaved] = useState(false);

  if (!legal || legal.specialTerms === null || amText === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        The AM added no special terms to this quote.
      </Typography>
    );
  }

  const save = (value: string, message: string) =>
    write.mutate(
      { specialTerms: cleanLegalText(value) },
      {
        onSuccess: () => {
          setSaved(true);
          setEditing(false);
          notify(message);
        },
      },
    );

  return (
    <Stack spacing={1.5} aria-label="Special terms">
      <Typography variant="caption" color="text.secondary">
        {deskText ? (
          <>
            Overridden by {shortName(legal.deskSpecialTermsByEmail) || "Deal Desk"} (Deal Desk) ·{" "}
            <Link component="button" type="button" variant="caption" onClick={() => setShowAM((v) => !v)}>
              {showAM ? "Hide what the AM wrote" : "Show what the AM wrote"}
            </Link>
          </>
        ) : (
          "Written by the AM"
        )}
      </Typography>
      {showAM && deskText ? (
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "action.hover", color: "text.secondary" }}>
          <LegalHtml html={amText} />
        </Box>
      ) : null}
      {editing ? (
        <LegalRichTextField
          label="Override special terms"
          value={text}
          onChange={(html) => {
            setSaved(false);
            setText(html);
          }}
          minHeight={minHeight}
          helperText="Your text replaces the AM's on the order form. Legal reviews the special terms after you approve."
        />
      ) : (
        <Box sx={{ p: 1.5, borderRadius: 1, border: 1, borderColor: "divider" }}>
          <LegalHtml html={current} />
        </Box>
      )}
      {write.error ? <Alert severity="error">{messageOf(write.error) ?? "Couldn't save the special terms. Try again."}</Alert> : null}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        {editing ? (
          <>
            <Button
              variant="outlined"
              onClick={() => save(text, "Special terms overridden")}
              disabled={sameLegalText(text, current) || cleanLegalText(text) === "" || write.isPending}
            >
              {write.isPending ? "Saving…" : "Save override"}
            </Button>
            <Button
              onClick={() => {
                setText(current);
                setEditing(false);
              }}
              disabled={write.isPending}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setSaved(false);
                setText(current);
                setEditing(true);
              }}
            >
              Override special terms
            </Button>
            {deskText ? (
              <Button onClick={() => save(amText, "The AM's special terms are back")} disabled={write.isPending}>
                Use the AM&apos;s text again
              </Button>
            ) : null}
          </>
        )}
        {saved ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "success.main" }} role="status">
            <CircleCheckIcon size={16} aria-hidden />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Saved on this version
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}
