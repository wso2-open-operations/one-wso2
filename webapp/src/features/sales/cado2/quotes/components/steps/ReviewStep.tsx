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

import { useMemo, type JSX, type ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Stack, TextField } from "@wso2/oxygen-ui";
import { MessageSquareTextIcon } from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";
import type { PricingPreview } from "@features/sales/cado2/quotes/api/quoteTypes";
import { useActiveLegalEntities, useLegalConfig } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { discountedLines, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import { sheetFromForm } from "@features/sales/cado2/quotes/sheet/sheetModel";
import QuoteSheet from "@features/sales/cado2/quotes/components/sheet/QuoteSheet";
import { SupportingDocumentsSummary } from "@features/sales/cado2/quotes/components/SupportingDocumentsCard";

interface ReviewStepProps {
  /** The pricing to show: stored for a frozen or unchanged version, else live. */
  readonly preview: PricingPreview | null;
  /** The saved legal entity's name, used when it is no longer in the active list. */
  readonly savedLegalEntityName: string | null;
  /** The live approval chain; null for a frozen version. */
  readonly approvals: ReactNode;
  /** The saved quote, for its supporting documents; null before the first save. */
  readonly quoteId?: number | null;
  /** The AM may still change the draft: the justification is written here (D141). */
  readonly editable?: boolean;
}

/**
 * Step ④ Review: the same read-only sheet as the quote page
 * (F4-1), built from the form, so the rep sees exactly what submitting will
 * freeze: the order form, the deal figures and, for multi-year, the schedule.
 * Last, just above Submit, the justification (D141): required when a line
 * has a discount (D58), optional for anything else non-standard.
 */
export default function ReviewStep({ preview, savedLegalEntityName, approvals, quoteId = null, editable = false }: ReviewStepProps): JSX.Element {
  const { control } = useFormContext<DraftFormValues>();
  const v = useWatch({ control }) as DraftFormValues;
  const legalEntities = useActiveLegalEntities();
  const legalConfig = useLegalConfig();
  const justificationIssue = useFieldIssue("justification");
  const discounted = discountedLines(v.lines ?? []);

  const active = legalEntities.data?.find((e) => String(e.id) === v.legalEntityId);
  const sheet = useMemo(() => {
    const legalEntity = active
      ? { name: active.name, country: active.country }
      : v.legalEntityId && savedLegalEntityName
        ? { name: savedLegalEntityName }
        : null;
    return sheetFromForm(v, preview, legalEntity, legalConfig.data ?? null);
  }, [v, preview, active, savedLegalEntityName, legalConfig.data]);

  return (
    <Stack spacing={2.5}>
      {/* A card of its own (the approval preview is a SectionCard). */}
      {approvals}
      <QuoteSheet sheet={sheet} />
      <SupportingDocumentsSummary quoteId={quoteId} />
      {editable ? (
        <SectionCard title="Justification" icon={<MessageSquareTextIcon size={18} />}>
          <Controller
            name="justification"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={discounted > 0 ? "Justification" : "Justification (optional)"}
                required={discounted > 0}
                multiline
                minRows={3}
                size="small"
                fullWidth
                error={Boolean(justificationIssue)}
                helperText={
                  justificationIssue ??
                  (discounted > 0
                    ? `Required: ${discounted === 1 ? "a line has" : `${discounted} lines have`} a discount. You can also explain anything else non-standard listed under the approvals.`
                    : "Optional. Explain anything non-standard to the approvers, such as what's listed under the approvals.")
                }
              />
            )}
          />
        </SectionCard>
      ) : null}
    </Stack>
  );
}
