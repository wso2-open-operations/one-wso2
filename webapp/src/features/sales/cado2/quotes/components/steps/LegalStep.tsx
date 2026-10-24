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
import {
  Alert,
  Box,
  Chip,
  DatePickers,
  FormControlLabel,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { FileTextIcon, PenLineIcon, ScaleIcon } from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import LegalHtml from "@features/sales/cado2/components/legal-rich-text/LegalHtml";
import LegalNotices from "@features/sales/cado2/components/legal-rich-text/LegalNotices";
import LegalQuote from "@features/sales/cado2/components/legal-rich-text/LegalQuote";
import LegalRichTextField from "@features/sales/cado2/components/legal-rich-text/LegalRichTextField";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLegalConfig } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { parseDateString, toDateString, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import {
  BLOCK_TITLE,
  CONTRACT_NAMES,
  legalMix,
  needsLegal,
  resolveLegal,
} from "@features/sales/cado2/quotes/form/legalModel";
import { SPECIAL_TERMS_BILLING } from "@features/sales/cado2/quotes/form/stepRules";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";

const { DatePicker } = DatePickers;

/** A labelled read-only value with where it came from. */
function FromSalesforce({ label, value, source }: { label: string; value: string; source: string }): JSX.Element {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, py: 0.75 }}>
        {value || "—"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {source}
      </Typography>
    </Box>
  );
}

// The theme's switch knob is white, so it vanishes on a white card when off
// (2026-10-24): a grey knob when off, the primary colour when on.
const VISIBLE_SWITCH = {
  "& .MuiSwitch-thumb": { bgcolor: "grey.600" },
  "& .MuiSwitch-switchBase.Mui-checked .MuiSwitch-thumb": { bgcolor: "primary.main" },
};

/**
 * Step ④ Legal (2026-10-24): the order form's legal
 * sections as they will print.
 *
 *   Governing Terms  a block per product type on the quote, on-prem (PS) and SaaS
 *                (CL): Legal's standard text, filled in; or "non-standard":
 *                Legal writes the terms during their approval. On a partner
 *                deal, the partner agreement first (name, partner, date)
 *   Notices      set by Legal; regional and renewal clauses appear by
 *                themselves, each saying why
 *   Special      the special terms, which Legal reviews and may reword
 */
export default function LegalStep(): JSX.Element {
  const { control } = useFormContext<DraftFormValues>();
  const v = useWatch({ control }) as DraftFormValues;
  const config = useLegalConfig();
  const partner = v.dealType === "PARTNER";
  const mix = legalMix(v.lines.map((l) => l.classification));
  // Cheap to work out, so worked out on every render.
  const sections = config.data
    ? resolveLegal(
        config.data,
        {
          ...mix,
          partner,
          region: v.accountSalesRegion,
          dealKind: v.dealKind,
          partnerName: v.partner?.name ?? "",
          contractName: v.partnerContractName,
          contractDate: v.partnerContractDate,
        },
        { onPremNonStandard: v.termsOnPremNonStandard, saasNonStandard: v.termsSaasNonStandard },
        { markFilled: true },
      )
    : null;
  const role = v.partner?.role?.trim() ?? "";
  const legal = needsLegal(mix, { onPremNonStandard: v.termsOnPremNonStandard, saasNonStandard: v.termsSaasNonStandard });
  const nameIssue = useFieldIssue("partnerContractName");
  const dateIssue = useFieldIssue("partnerContractDate");
  const specialIssue = useFieldIssue("specialTerms.text");
  const billingNeedsSpecialTerms = v.billingFrequency === "SPECIAL_TERMS" && !v.specialTermsEnabled;

  if (config.error) {
    return (
      <ErrorNotice error={config.error} onRetry={() => void config.refetch()} retrying={config.isFetching}>
        Couldn&apos;t load the legal texts.
      </ErrorNotice>
    );
  }

  return (
    <Stack spacing={2.5}>
      <SectionCard
        title="Governing Terms"
        icon={<ScaleIcon size={18} />}
        aside={
          <Chip size="small" variant="outlined" label={legal ? "Goes to Legal" : "Standard"} />
        }
      >
        <Stack spacing={2}>
          {partner ? (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
              {/* The AM chooses; the Salesforce partner role is only a hint (2026-10-24). */}
              <Controller
                name="partnerContractName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    size="small"
                    label="Partner agreement"
                    required
                    error={Boolean(nameIssue)}
                    helperText={nameIssue ?? (role ? `Salesforce partner role: ${role}` : "No partner role in Salesforce")}
                  >
                    {CONTRACT_NAMES.map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <FromSalesforce label="Partner" value={v.partner?.name ?? ""} source="From Salesforce" />
              <Controller
                name="partnerContractDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Agreement date"
                    value={parseDateString(field.value)}
                    onChange={(d: Date | null) => field.onChange(d && !Number.isNaN(d.getTime()) ? toDateString(d) : "")}
                    slotProps={{
                      textField: {
                        size: "small",
                        required: true,
                        error: Boolean(dateIssue),
                        helperText: dateIssue ?? "The date of the partner agreement",
                      },
                    }}
                  />
                )}
              />
            </Box>
          ) : null}

          {!sections ? (
            <Skeleton variant="rounded" height={140} aria-label="Loading the legal texts" />
          ) : (
            sections.blocks.map((b) => {
              const name = b.kind === "ONPREM" ? "termsOnPremNonStandard" : "termsSaasNonStandard";
              return (
                <Box key={b.kind} component="section" aria-label={BLOCK_TITLE[b.kind]}>
                  {/* A block's name only when there are two, as the order form prints it. */}
                  {sections.blocks.length > 1 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 700, mb: 1 }}>
                      {BLOCK_TITLE[b.kind]}
                    </Typography>
                  ) : null}
                  {b.nonStandard ? (
                    <Typography variant="body2" color="text.secondary">
                      Legal will write these terms during their approval.
                    </Typography>
                  ) : (
                    <LegalQuote>
                      <LegalHtml html={b.text} marks />
                    </LegalQuote>
                  )}
                  <Controller
                    name={name}
                    control={control}
                    render={({ field }) => (
                      // Only the switch changes it; the words beside it don't (2026-10-24).
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                        <Switch
                          checked={field.value}
                          onChange={(_, on) => field.onChange(on)}
                          sx={VISIBLE_SWITCH}
                          slotProps={{ input: { role: "switch", "aria-label": `Non-standard terms: ${BLOCK_TITLE[b.kind]}` } }}
                        />
                        <Typography variant="body2">Non-standard terms</Typography>
                      </Stack>
                    )}
                  />
                </Box>
              );
            })
          )}
        </Stack>
      </SectionCard>

      <SectionCard
        title="Legal Terms and Notices"
        icon={<FileTextIcon size={18} />}
        aside={<Chip size="small" variant="outlined" label="Standard" />}
      >
        {!sections ? <Skeleton variant="rounded" height={120} /> : <LegalNotices notices={sections.notices} reasons />}
      </SectionCard>

      <SectionCard title="Special Terms" icon={<PenLineIcon size={18} />}>
        <Stack spacing={1.5}>
          {billingNeedsSpecialTerms ? <Alert severity="warning">{SPECIAL_TERMS_BILLING}</Alert> : null}
          <Controller
            name="specialTermsEnabled"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(_, on) => field.onChange(on)} sx={VISIBLE_SWITCH} slotProps={{ input: { role: "switch" } }} />}
                label={`Special terms: ${field.value ? "On" : "Off"}`}
              />
            )}
          />
          {v.specialTermsEnabled ? (
            <Controller
              name="specialTerms"
              control={control}
              render={({ field }) => (
                <LegalRichTextField
                  label="Special terms"
                  value={field.value}
                  onChange={field.onChange}
                  required
                  error={Boolean(specialIssue)}
                  helperText={specialIssue ?? "Legal reviews these and may reword them during their approval."}
                />
              )}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Special terms go to Legal for approval.
            </Typography>
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
