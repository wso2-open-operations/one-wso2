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
import { useFormContext, useWatch } from "react-hook-form";
import { Stack } from "@wso2/oxygen-ui";
import type { PricingPreview } from "@features/sales/cado2/quotes/api/quoteTypes";
import { useActiveLegalEntities, useLegalConfig } from "@features/sales/cado2/quotes/api/useQuoteApi";
import type { DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import { sheetFromForm } from "@features/sales/cado2/quotes/sheet/sheetModel";
import QuoteSheet from "@features/sales/cado2/quotes/components/sheet/QuoteSheet";

interface ReviewStepProps {
  /** The pricing to show: stored for a frozen or unchanged version, else live. */
  readonly preview: PricingPreview | null;
  /** The saved legal entity's name, used when it is no longer in the active list. */
  readonly savedLegalEntityName: string | null;
  /** The live approval chain; null for a frozen version. */
  readonly approvals: ReactNode;
}

/**
 * Step ④ Review: the same read-only sheet as the quote page
 * (F4-1), built from the form, so the rep sees exactly what submitting will
 * freeze: the order form, the deal figures and, for multi-year, the schedule.
 */
export default function ReviewStep({ preview, savedLegalEntityName, approvals }: ReviewStepProps): JSX.Element {
  const { control } = useFormContext<DraftFormValues>();
  const v = useWatch({ control }) as DraftFormValues;
  const legalEntities = useActiveLegalEntities();
  const legalConfig = useLegalConfig();

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
    </Stack>
  );
}
