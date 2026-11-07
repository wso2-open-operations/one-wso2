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
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { MenuItem, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { ReceiptIcon } from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { BILLING_LABEL, BILLING_OPTIONS, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";

/**
 * How often the customer is invoiced (D85), its own card on Commercials since D86. Shown
 * on every quote, services-only included (D88). It never changes the price: only "Upon the
 * Execution of the Order Form" moves everything into Year 1's billing.
 * "See Special Terms" points at the special terms, in the Terms card below.
 */
export default function BillingFrequencyCard(): JSX.Element {
  const { control } = useFormContext<DraftFormValues>();
  const billing = useWatch({ control, name: "billingFrequency" });
  const issue = useFieldIssue("billingFrequency");
  return (
    <SectionCard title="Billing Frequency" icon={<ReceiptIcon size={18} />}>
      <Stack spacing={1}>
        <Controller
          name="billingFrequency"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label="Billing frequency"
              size="small"
              required
              sx={{ maxWidth: 360 }}
              error={Boolean(issue)}
              helperText={issue}
            >
              {BILLING_OPTIONS.map((b) => (
                <MenuItem key={b} value={b}>
                  {BILLING_LABEL[b]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        {billing === "SPECIAL_TERMS" ? (
          <Typography variant="body2" color="text.secondary">
            Describe the billing in the special terms, on the Legal step.
          </Typography>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
