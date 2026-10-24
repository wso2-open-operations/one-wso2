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

import type { JSX, ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Alert, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { MapPinIcon, MessageSquareTextIcon, TruckIcon } from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { useAccountContacts } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { discountedLines, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import AddressFields from "@features/sales/cado2/quotes/components/AddressFields";
import ContactPicker from "@features/sales/cado2/quotes/components/ContactPicker";
import BillingFrequencyCard from "@features/sales/cado2/quotes/components/BillingFrequencyCard";
import PaymentTermsCard from "@features/sales/cado2/quotes/components/PaymentTermsCard";

/** A step section: the app-wide section card, with an optional hint. */
function Section({ title, icon, hint, children }: { title: string; icon: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <SectionCard title={title} icon={icon}>
      <Stack spacing={2}>
        {hint ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            {hint}
          </Typography>
        ) : null}
        {children}
      </Stack>
    </SectionCard>
  );
}

/**
 * Step ③ Commercials (D86): how often it is invoiced (every quote, D88)
 * and when each invoice is due, who is billed and who receives it (each
 * with its contact; the PO number in Bill To), and the justification. The
 * terms moved to the Legal step.
 */
export default function CommercialStep(): JSX.Element {
  const { control } = useFormContext<DraftFormValues>();
  const [accountId, dealType, sameAsBillTo, lines] = useWatch({
    control,
    name: ["accountId", "dealType", "shipToSameAsBillTo", "lines"],
  });
  const contacts = useAccountContacts(accountId || null);
  const partnerDeal = dealType === "PARTNER";
  const discounted = discountedLines(lines);

  return (
    <Stack spacing={2.5}>
      <BillingFrequencyCard />
      <PaymentTermsCard />

      <Section
        title="Bill To"
        icon={<MapPinIcon size={18} />}
        hint={partnerDeal ? "Partner deal: the partner is billed." : "Direct deal: the customer is billed."}
      >
        <AddressFields name="billTo" />
        <Controller
          name="poNumber"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="PO number (optional)"
              size="small"
              sx={{ maxWidth: 360 }}
              helperText="The customer's purchase order reference, printed on invoices"
            />
          )}
        />
        <ContactPicker
          name="billingContact"
          issueField="contacts.billing"
          label="Billing contact"
          contacts={contacts.data ?? []}
          loading={contacts.isFetching}
          loadError={contacts.error}
          onRetry={() => void contacts.refetch()}
          helperText="Receives invoices"
        />
      </Section>

      <Section title="Ship To" icon={<TruckIcon size={18} />} hint={partnerDeal ? "Partner deal: shipped to the end customer." : undefined}>
        {!partnerDeal ? (
          <Controller
            name="shipToSameAsBillTo"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(_, v) => field.onChange(v)} />}
                label="Same as bill to"
              />
            )}
          />
        ) : null}
        {partnerDeal || !sameAsBillTo ? <AddressFields name="shipTo" /> : null}
        <ContactPicker
          name="securityContact"
          issueField="contacts.security"
          label="Security contact (optional)"
          contacts={contacts.data ?? []}
          loading={contacts.isFetching}
          loadError={contacts.error}
          onRetry={() => void contacts.refetch()}
          helperText="Receives WSO2 security bulletins"
        />
      </Section>

      <Section title="Justification" icon={<MessageSquareTextIcon size={18} />} hint="Why this quote needs anything non-standard. Future approvers will read it.">
        {discounted > 0 ? (
          <Alert severity="info">
            A discount has been added to {discounted === 1 ? "a line" : `${discounted} lines`}, so a justification is
            required.
          </Alert>
        ) : null}
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
            />
          )}
        />
      </Section>
    </Stack>
  );
}
