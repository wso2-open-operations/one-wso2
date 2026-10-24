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
 * they may reword. Saved on the version (and in its history); Approve
 * waits until every non-standard block is written.
 */
export default function LegalTermsEditor({
  quoteId,
  versionNumber,
  legal,
}: {
  quoteId: number;
  versionNumber: number;
  legal: LegalView;
}): JSX.Element {
  const write = useWriteLegalTerms(quoteId, versionNumber);
  const notify = useCado2Toast();
  const blocks = legal.sections.blocks.filter((b) => b.nonStandard);
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(blocks.map((b) => [b.kind, b.text])));
  const [special, setSpecial] = useState(legal.specialTerms ?? "");
  const partner = legal.contractName || legal.contractDate;
  // Compared as clean rich text, so opening the editor doesn't count as a change.
  const changed =
    blocks.some((b) => !sameLegalText(texts[b.kind] ?? "", b.text)) ||
    (legal.specialTerms !== null && !sameLegalText(special, legal.specialTerms ?? ""));

  const save = () =>
    write.mutate(
      {
        onPremTerms: blocks.some((b) => b.kind === "ONPREM") ? cleanLegalText(texts.ONPREM ?? "") : undefined,
        saasTerms: blocks.some((b) => b.kind === "SAAS") ? cleanLegalText(texts.SAAS ?? "") : undefined,
        specialTerms: legal.specialTerms !== null ? cleanLegalText(special) : undefined,
      },
      { onSuccess: () => notify("Terms saved") },
    );

  if (blocks.length === 0 && legal.specialTerms === null) {
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
          onChange={(html) => setTexts((t) => ({ ...t, [b.kind]: html }))}
          minHeight={140}
          required
          helperText="The AM marked these non-standard: write the terms that apply to this customer."
        />
      ))}
      {legal.specialTerms !== null ? (
        <LegalRichTextField
          label="Special terms"
          value={special}
          onChange={setSpecial}
          helperText={
            legal.specialTermsByLegal ? `Reworded by Legal. The AM wrote: "${legalPlainText(legal.amSpecialTerms ?? "")}"` : "As the AM wrote them: reword if needed."
          }
        />
      ) : null}
      {write.error ? <Alert severity="error">{messageOf(write.error) ?? "Couldn't save the terms. Try again."}</Alert> : null}
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={save} disabled={!changed || write.isPending}>
          {write.isPending ? "Saving…" : "Save terms"}
        </Button>
      </Stack>
    </Stack>
  );
}
