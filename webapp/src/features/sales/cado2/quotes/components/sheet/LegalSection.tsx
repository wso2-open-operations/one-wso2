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

import type { JSX } from "react";
import { Box, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { ScaleIcon } from "@wso2/oxygen-ui-icons-react";
import SheetCard from "@features/sales/cado2/components/section-card/SectionCard";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { BLOCK_TITLE } from "@features/sales/cado2/quotes/form/legalModel";
import type { QuoteSheet } from "@features/sales/cado2/quotes/sheet/sheetModel";
import LegalHtml from "@features/sales/cado2/components/legal-rich-text/LegalHtml";
import LegalNotices from "@features/sales/cado2/components/legal-rich-text/LegalNotices";
import LegalQuote from "@features/sales/cado2/components/legal-rich-text/LegalQuote";
import { isEmptyLegalText } from "@features/sales/cado2/utils/legalRichText";

function Heading({ title }: { title: string }): JSX.Element {
  return (
    <Typography variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1.6 }}>
      {title}
    </Typography>
  );
}

/**
 * The order form's legal sections, read-only: Governing
 * Terms (a block per product type; Legal's own terms where non-standard),
 * notices, special terms (Legal's wording when they changed it). As
 * submitted on a frozen version.
 */
export default function LegalSection({ sheet }: { sheet: QuoteSheet }): JSX.Element | null {
  const legal = sheet.legal;
  if (!legal) return null;
  const { sections } = legal;
  return (
    <SheetCard
      title="Legal"
      icon={<ScaleIcon size={18} />}
      aside={
        legal.frozen ? (
          <Typography variant="body2" color="text.secondary">
            As submitted
          </Typography>
        ) : undefined
      }
    >
      <Stack spacing={2.5}>
        <Box>
          <Heading title="Governing terms" />
          {sheet.dealType === "PARTNER" ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {legal.contractName || "No partner agreement chosen"} · {legal.partnerName || "—"} ·{" "}
              {legal.contractDate ? formatDate(legal.contractDate) : "no agreement date"}
            </Typography>
          ) : null}
          <Stack spacing={1.5}>
            {sections.blocks.map((b) => (
              <Box key={b.kind}>
                {sections.blocks.length > 1 || b.nonStandard ? (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, flexWrap: "wrap", rowGap: 0.5 }}>
                    {sections.blocks.length > 1 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {BLOCK_TITLE[b.kind]}
                      </Typography>
                    ) : null}
                    {b.nonStandard ? <Chip size="small" variant="outlined" label="Written by Legal" /> : null}
                  </Stack>
                ) : null}
                {b.nonStandard && isEmptyLegalText(b.text) ? (
                  <Typography variant="body2" color="text.secondary">
                    Legal writes these terms during their approval.
                  </Typography>
                ) : (
                  <LegalQuote>
                    <LegalHtml html={b.text} />
                  </LegalQuote>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
        <Box>
          <Heading title="Legal terms and notices" />
          <LegalNotices notices={sections.notices} />
        </Box>
        <Box>
          <Heading title="Special terms" />
          {legal.specialTerms ? (
            <>
              <LegalQuote>
                <LegalHtml html={legal.specialTerms} />
              </LegalQuote>
              {legal.specialTermsByLegal ? (
                <Typography variant="caption" color="text.secondary">
                  Reworded by Legal during their approval
                </Typography>
              ) : null}
            </>
          ) : (
            <Typography variant="body2">None</Typography>
          )}
        </Box>
      </Stack>
    </SheetCard>
  );
}
