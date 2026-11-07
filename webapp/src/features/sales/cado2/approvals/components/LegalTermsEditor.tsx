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
import { Alert, Button, Stack, Typography } from "@wso2/oxygen-ui";
import { CircleCheckIcon } from "@wso2/oxygen-ui-icons-react";
import type { LegalView } from "@features/sales/cado2/quotes/api/quoteTypes";
import { useWriteLegalTerms } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { messageOf } from "@features/sales/cado2/quotes/api/errors";
import { BLOCK_TITLE } from "@features/sales/cado2/quotes/form/legalModel";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import LegalRichTextField from "@features/sales/cado2/components/legal-rich-text/LegalRichTextField";
import { cleanLegalText, legalPlainText, sameLegalText } from "@features/sales/cado2/utils/legalRichText";

/**
 * Legal's part of their approval: the non-standard
 * governing terms, which only Legal writes, and the special terms, which
 * they may override (D139). Saved on the version (and in its history); Approve
 * waits until every non-standard block is written.
 */
export default function LegalTermsEditor({
  quoteId,
  versionNumber,
  legal,
  minHeight = 140,
  part = "both",
}: {
  quoteId: number;
  versionNumber: number;
  legal: LegalView;
  /** The editors' height; taller in the lens's own section (D129). */
  minHeight?: number;
  /**
   * Under Legal's lens (D129) the governing terms and the special terms are
   * written in their own places, each saved on its own; elsewhere, both.
   */
  part?: "both" | "governing" | "special";
}): JSX.Element {
  const write = useWriteLegalTerms(quoteId, versionNumber);
  const notify = useCado2Toast();
  const blocks = part === "special" ? [] : legal.sections.blocks.filter((b) => b.nonStandard);
  const withSpecial = part !== "governing" && legal.specialTerms !== null;
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(blocks.map((b) => [b.kind, b.text])));
  const [special, setSpecial] = useState(legal.specialTerms ?? "");
  // Saved and not changed since: the button says so, in green, until the next edit.
  const [saved, setSaved] = useState(false);
  const partner = part !== "special" && (legal.contractName || legal.contractDate);
  // Compared as clean rich text, so opening the editor doesn't count as a change.
  const changed =
    blocks.some((b) => !sameLegalText(texts[b.kind] ?? "", b.text)) ||
    (withSpecial && !sameLegalText(special, legal.specialTerms ?? ""));

  const save = () =>
    write.mutate(
      {
        onPremTerms: blocks.some((b) => b.kind === "ONPREM") ? cleanLegalText(texts.ONPREM ?? "") : undefined,
        saasTerms: blocks.some((b) => b.kind === "SAAS") ? cleanLegalText(texts.SAAS ?? "") : undefined,
        specialTerms: withSpecial ? cleanLegalText(special) : undefined,
      },
      {
        onSuccess: () => {
          setSaved(true);
          notify(part === "special" ? "Special terms saved" : part === "governing" ? "Governing terms saved" : "Terms saved");
        },
      },
    );

  if (blocks.length === 0 && !withSpecial) {
    return (
      <Typography variant="body2" color="text.secondary">
        The terms on this quote are standard.
      </Typography>
    );
  }
  return (
    <Stack spacing={2} aria-label="Legal terms">
      {partner ? (
        <Typography variant="body2" color="text.secondary">
          Partner agreement: {legal.contractName || "not chosen"} · {legal.partnerName || "—"} · {legal.contractDate ?? "no date"}
        </Typography>
      ) : null}
      {blocks.map((b) => (
        <LegalRichTextField
          key={b.kind}
          label={`${BLOCK_TITLE[b.kind]}: governing terms`}
          value={texts[b.kind] ?? ""}
          onChange={(html) => {
            setSaved(false);
            setTexts((t) => ({ ...t, [b.kind]: html }));
          }}
          minHeight={minHeight}
          required
          helperText="The AM marked these non-standard: write the terms that apply to this customer."
        />
      ))}
      {withSpecial ? (
        <LegalRichTextField
          label="Special terms"
          value={special}
          onChange={(html) => {
            setSaved(false);
            setSpecial(html);
          }}
          minHeight={part === "special" ? minHeight : undefined}
          helperText={
            legal.specialTermsByLegal
              ? `Overridden by Legal. Before: "${legalPlainText(legal.deskSpecialTerms ?? legal.amSpecialTerms ?? "")}"`
              : legal.deskSpecialTerms
                ? "Override Deal Desk's special terms: change the wording only if it needs it."
                : "Override the AM's special terms: change the wording only if it needs it."
          }
        />
      ) : null}
      {write.error ? <Alert severity="error">{messageOf(write.error) ?? "Couldn't save the terms. Try again."}</Alert> : null}
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Button variant="outlined" onClick={save} disabled={saved || !changed || write.isPending}>
          {write.isPending ? "Saving…" : part === "special" ? "Save special terms" : part === "governing" ? "Save governing terms" : "Save terms"}
        </Button>
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
