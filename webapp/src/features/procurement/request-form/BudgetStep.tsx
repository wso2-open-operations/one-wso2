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

import { Alert, Box, Button, IconButton, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { PlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useBudgetApprovers, useEngagementCodes } from "../api/useProcurement";
import type { BudgetDetails, ProcurementLookups, Vendor } from "../types";
import AttachmentsField from "./AttachmentsField";
import { OptionField, SectionHeading, StepTitle, TextInput } from "./formFields";
import { budgetLabel, emptyVendor, MAX_VENDORS, type RequestDraft } from "./requestFormModel";

const TWO_COLUMNS = { display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } } as const;
const THREE_COLUMNS = { display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } } as const;

function VendorBlock({
  vendor,
  index,
  total,
  removable,
  onChange,
  onRemove,
}: {
  vendor: Vendor;
  index: number;
  total: number;
  removable: boolean;
  onChange: (patch: Partial<Vendor>) => void;
  onRemove: () => void;
}) {
  return (
    <Stack spacing={2.5} sx={{ p: 2.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">{total > 1 ? `Proposed vendor ${index + 1}` : "Proposed vendor"}</Typography>
        {removable && (
          <IconButton size="small" aria-label={`Remove vendor ${index + 1}`} onClick={onRemove}>
            <XIcon size={16} />
          </IconButton>
        )}
      </Stack>
      <Box sx={TWO_COLUMNS}>
        <TextInput label="Vendor name (if known)" name={`vendorName.${index}`} value={vendor.name} onChange={(name) => onChange({ name })} />
        <TextInput type="url" label="Vendor website" name={`vendorWebsite.${index}`} placeholder="e.g. https://www.supplier.com" value={vendor.website} onChange={(website) => onChange({ website })} />
      </Box>
      <Box sx={THREE_COLUMNS}>
        <TextInput label="Contact name" maxLength={150} value={vendor.contact} onChange={(contact) => onChange({ contact })} />
        <TextInput type="email" label="Contact email" name={`vendorEmail.${index}`} maxLength={254} value={vendor.email} onChange={(email) => onChange({ email })} />
        <TextInput type="tel" label="Contact number" maxLength={50} value={vendor.phone} onChange={(phone) => onChange({ phone })} />
      </Box>
    </Stack>
  );
}

// Step 4. The proposed vendors, budget and who approves it.
export default function BudgetStep({
  draft,
  lookups,
  onChange,
}: {
  draft: RequestDraft;
  lookups: ProcurementLookups;
  onChange: (patch: Partial<RequestDraft>) => void;
}) {
  const required = draft.category === "NON-IT" || draft.category === "EVENTS";
  const isEvent = draft.category === "EVENTS";
  const b = draft.budget;
  // The engagement codes are asked for by the unit's name; the approvers by its code.
  const unitName = lookups.businessUnits.find((u) => u.value === b.businessUnit)?.label ?? "";
  const codes = useEngagementCodes(unitName);
  const approvers = useBudgetApprovers({ businessUnit: b.businessUnit, region: b.region });
  const approverChoices = (approvers.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const setBudget = (patch: Partial<BudgetDetails>) => onChange({ budget: { ...b, ...patch } });
  // Another business unit or region means other codes and approvers apply, so a pick made under the old one is cleared.
  const changeUnit = (businessUnit: string) => onChange({ budget: { ...b, businessUnit, engagementCode: "" }, budgetApproverId: "" });
  const changeRegion = (region: string) => onChange({ budget: { ...b, region }, budgetApproverId: "" });
  const setVendor = (index: number, patch: Partial<Vendor>) =>
    onChange({ vendors: draft.vendors.map((v, i) => (i === index ? { ...v, ...patch } : v)) });

  return (
    <Stack spacing={2.5} sx={{ py: 1 }}>
      <StepTitle>{budgetLabel(draft.category)}</StepTitle>

      {!isEvent && (
        <>
          <SectionHeading first>Vendors</SectionHeading>
          {draft.vendors.map((vendor, index) => (
            <VendorBlock
              key={index}
              vendor={vendor}
              index={index}
              total={draft.vendors.length}
              removable={draft.vendors.length > 1}
              onChange={(patch) => setVendor(index, patch)}
              onRemove={() => onChange({ vendors: draft.vendors.filter((_, i) => i !== index) })}
            />
          ))}
          <Button size="small" startIcon={<PlusIcon size={16} />} disabled={draft.vendors.length >= MAX_VENDORS} onClick={() => onChange({ vendors: [...draft.vendors, emptyVendor()] })} sx={{ alignSelf: "flex-start" }}>
            Add another vendor
          </Button>
        </>
      )}

      <SectionHeading first={isEvent}>{isEvent ? "What are the budget details?" : "Budget details"}</SectionHeading>
      <Box sx={THREE_COLUMNS}>
        <OptionField label="Budget category" name="budgetCategory" required={required} choices={lookups.budgetCategories} value={b.category} onChange={(category) => setBudget({ category })} />
        <OptionField label="Business unit" name="businessUnit" required={required} choices={lookups.businessUnits} value={b.businessUnit} onChange={changeUnit} />
        <OptionField label="Product" name="budgetProduct" required={required} choices={lookups.products} value={b.product} onChange={(product) => setBudget({ product })} />
        <OptionField label="Region" name="region" required={required} choices={lookups.regions} value={b.region} onChange={changeRegion} />
        <OptionField
          label={isEvent ? "Engagement code / Budget owner" : "Engagement code"} name="engagementCode"
          required={required}
          choices={codes.data ?? []}
          value={b.engagementCode}
          onChange={(engagementCode) => setBudget({ engagementCode })}
          disabled={!b.businessUnit}
          placeholder={!b.businessUnit ? "Select a business unit first" : codes.isFetching ? "Loading…" : undefined}
          emptyText="No engagement codes for this business unit"
        />
        <TextInput label="Salesforce campaign name (if applicable)" value={b.salesforceCampaign} onChange={(salesforceCampaign) => setBudget({ salesforceCampaign })} />
      </Box>
      {codes.isError && <Alert severity="error">{describeError(codes.error)}</Alert>}

      <SectionHeading>Budget approval</SectionHeading>
      <OptionField
        label="Budget approver" name="budgetApprover"
        required={required && !isEvent}
        choices={approverChoices}
        value={draft.budgetApproverId}
        onChange={(budgetApproverId) => onChange({ budgetApproverId })}
        disabled={!b.businessUnit && !b.region}
        placeholder={!b.businessUnit && !b.region ? "Select a business unit or region first" : approvers.isFetching ? "Loading…" : undefined}
        emptyText="No budget approver covers this business unit or region"
      />
      {approvers.isError && <Alert severity="error">{describeError(approvers.error)}</Alert>}

      {!isEvent && (
        <>
          <SectionHeading>Notes</SectionHeading>
          <TextInput
            multiline
            minRows={3}
            label="Notes for the Procurement team"
            placeholder="Anything else Procurement should know: deadlines, existing quotes, contract references…"
            value={draft.notes}
            onChange={(notes) => onChange({ notes })}
          />
        </>
      )}

      {(!isEvent || draft.event.eventType !== "INDUSTRY_EVENT_SPONSORSHIP") && (
        <>
          <SectionHeading>Attachments</SectionHeading>
          <AttachmentsField label="Quotes, specifications or other documents" value={draft.attachments} onChange={(attachments) => onChange({ attachments })} />
        </>
      )}
    </Stack>
  );
}
