/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "../util/financeError";
import {
  Field,
  FieldLabel,
  FieldRow,
  FundingSources,
  INFO_SIDEBAR_WIDTH,
  JobNumberAutocomplete,
  JobNumberSideBar,
  Placeholder,
  SearchableSelect,
} from "./ccFormFields";
import { isValidJobNumberFormat, normalizeJobNumber } from "./ccJobNumber";
import {
  applyBulkEdit,
  clearBulkDependents,
  CC_BULK_EDIT_EMPTY,
  type CcBulkEditForm,
} from "./ccPendingSubmissions";
import { useCcJobNumberDetails, useCcMenus } from "./useCc";
import { CC_MARKETING_CATEGORY, CC_TRAVEL_CATEGORY, type CcTransaction } from "./ccTypes";

const COMMENT_MAX = 30;

/**
 * Categorise several transactions at once — the source's EditPaneModal.
 *
 * Only the fields you fill in are applied; everything left blank is untouched
 * on every selected row, so this can set just a comment across twelve rows
 * without flattening the categories they already have.
 *
 * Deliberately matching the source and worth stating, because both look like
 * omissions: there is **no confirmation step**, and the selection is **not
 * cleared** after Apply — the reader usually wants to submit the rows they
 * just finished, and clearing would make them tick all twelve again.
 */
export function CcBulkEditDialog({
  open,
  txns,
  onClose,
  onApply,
}: {
  open: boolean;
  /** The selected rows, with any unsaved categorisation already applied. */
  txns: CcTransaction[];
  onClose: () => void;
  onApply: (rows: CcTransaction[]) => Promise<void>;
}) {
  const menus = useCcMenus();
  const [form, setForm] = useState<CcBulkEditForm>(CC_BULK_EDIT_EMPTY);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundingOpen, setFundingOpen] = useState(false);

  const categories = useMemo(
    () => [...(menus.expenseTypes.data?.categories ?? [])].sort((a, b) => a.localeCompare(b)),
    [menus.expenseTypes.data],
  );
  const subRegions = menus.subRegions.data?.subRegions ?? [];
  const productUnits = useMemo(() => menus.units.data?.productUnits ?? [], [menus.units.data]);
  const businessUnits = useMemo(() => menus.units.data?.businessUnits ?? [], [menus.units.data]);
  const typeOptions = useMemo(
    () =>
      form.expenseCategory
        ? [...(menus.expenseTypes.data?.types[form.expenseCategory] ?? [])].sort((a, b) => a.localeCompare(b))
        : [],
    [form.expenseCategory, menus.expenseTypes.data],
  );

  // CcEditDialog.tsx — Product Unit options grouped under a Business Unit
  // subheader rather than spelling the business unit out in each option's
  // own label, in whichever order the menu arrays list the business units
  // (first appearance wins a group's position).
  const unitGroups = useMemo(() => {
    const groups = new Map<string, { i: number; label: string }[]>();
    productUnits.forEach((pu, i) => {
      const bu = businessUnits[i] || "Other";
      if (!groups.has(bu)) groups.set(bu, []);
      groups.get(bu)!.push({ i, label: pu });
    });
    return Array.from(groups.entries());
  }, [productUnits, businessUnits]);

  // EditPaneModal.tsx:214-228 — a travel row's units come from its job number,
  // so the unit field is not offered; sub-region is a marketing-only field.
  //
  // With no category chosen the question is the selection's own: offer the unit
  // while at least one selected row is not Travel, and hide it when every one
  // of them is, rather than showing a control that `applyBulkEdit` would refuse
  // to apply to any of them.
  const showProductUnit = form.expenseCategory
    ? form.expenseCategory !== CC_TRAVEL_CATEGORY
    : txns.some((t) => t.expenseCategoryLabel !== CC_TRAVEL_CATEGORY);
  const showSubRegion = form.expenseCategory.startsWith(CC_MARKETING_CATEGORY);
  const showJobNumber = form.expenseCategory === CC_TRAVEL_CATEGORY;

  const jobNumbers = menus.jobNumbers.data?.jobNumbers ?? [];
  // Only look a job up once it could exist. The list holds the past year, so a
  // number typed in full is checked on its shape before the request.
  const jobLookupKey =
    showJobNumber && form.travelJobNumber &&
    (jobNumbers.includes(form.travelJobNumber) || isValidJobNumberFormat(form.travelJobNumber))
      ? normalizeJobNumber(form.travelJobNumber)
      : undefined;
  const jobDetails = useCcJobNumberDetails(jobLookupKey);
  const jobUnits = jobDetails.data;

  const jobMalformed = Boolean(
    showJobNumber && form.travelJobNumber && !jobLookupKey,
  );
  const jobNotFound = Boolean(jobLookupKey) && jobDetails.isError;
  const jobPending = Boolean(jobLookupKey) && !jobUnits && !jobNotFound;
  // A job with no funding sources cannot be charged against, so it is refused
  // rather than written across the selection — as the single-row panel does.
  const jobUnusable = Boolean(jobUnits) && (jobUnits?.fundingSources.length ?? 0) === 0;
  const fundingSources = jobUnits?.fundingSources ?? [];
  // Warned about rather than refused: a job can come back without units and
  // still be charged against, as the single-row panel treats it.
  const jobMissingUnits = Boolean(jobUnits) && !(jobUnits?.productUnit && jobUnits?.businessUnit);
  // The funding shares split what is being charged, which across a bulk edit
  // is every selected row's amount, not one transaction's.
  const selectionAmount = txns.reduce((sum, t) => sum + t.txnAmount, 0);
  const jobBlocked = jobMalformed || jobNotFound || jobPending || jobUnusable;
  const jobHelperText = jobMalformed
    ? "Enter a valid value in the format TRV-YYYY-MM-NNNN"
    : jobNotFound
      ? "Could not verify this job number"
      : jobUnusable
        ? "That job has no funding sources to charge against."
        : jobPending
          ? "Checking the job number…"
          : "Not listed? Type the full job number.";

  const set = (field: keyof CcBulkEditForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value, ...clearBulkDependents(field, prev) }));

  const close = () => {
    setForm(CC_BULK_EDIT_EMPTY);
    setError(null);
    onClose();
  };

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      await onApply(
        applyBulkEdit(
          form,
          txns,
          { productUnits, businessUnits },
          // The job's units as returned, even if only one of the pair is set.
          jobUnits
            ? { productUnit: jobUnits.productUnit, businessUnit: jobUnits.businessUnit }
            : null,
        ),
      );
      setForm(CC_BULK_EDIT_EMPTY);
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
        Edit multiple credit card records
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 400 }}>
          {txns.length} selected · only the fields you fill in are changed
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <FieldRow>
            <Field label="Expense Category">
              <SearchableSelect
                value={form.expenseCategory}
                options={categories}
                disabled={applying}
                onChange={(v) => set("expenseCategory", v)}
              />
            </Field>
            <Field label="Expense Type">
              <SearchableSelect
                value={form.expenseType}
                options={typeOptions}
                disabled={applying || !form.expenseCategory}
                onChange={(v) => set("expenseType", v)}
              />
            </Field>
          </FieldRow>

          {showJobNumber && (
            <FieldRow>
              <Field label="Travel Job Number">
                <JobNumberAutocomplete
                  value={form.travelJobNumber}
                  options={jobNumbers}
                  disabled={applying}
                  error={jobMalformed || jobNotFound || jobUnusable}
                  helperText={jobHelperText}
                  infoWidth={INFO_SIDEBAR_WIDTH}
                  info={
                    jobUnits ? (
                      <JobNumberSideBar
                        details={jobUnits}
                        fundingCount={fundingSources.length}
                        onOpenFunding={() => setFundingOpen(true)}
                      />
                    ) : undefined
                  }
                  onChange={(v) => set("travelJobNumber", v ?? "")}
                />
                {!jobUnusable && jobMissingUnits && (
                  <Alert severity="warning" sx={{ mt: 1, fontSize: 12.5 }}>
                    No Product unit and/or Business unit found for the selected Job number.
                  </Alert>
                )}
              </Field>
            </FieldRow>
          )}

          <Box>
            <FieldLabel>Comment</FieldLabel>
            <TextField
              size="small"
              fullWidth
              disabled={applying}
              value={form.comment}
              onChange={(e) => set("comment", e.target.value.slice(0, COMMENT_MAX))}
              placeholder="Applied to every selected transaction"
              helperText={`${form.comment.length}/${COMMENT_MAX}`}
              inputProps={{ "aria-label": "Comment", maxLength: COMMENT_MAX }}
            />
          </Box>

          <FieldRow>
            {showProductUnit && (
              // FieldRow is a CSS grid of `minmax(170px, 1fr)` tracks — with
              // Sub Region hidden (most categories), Product Unit is the only
              // child, so the lone 1fr track stretches across the whole row
              // and the Select's open menu, which matches its anchor's width,
              // stretches with it. Capped here so it stays the width it has
              // everywhere else (CcEditDialog/CcCategorisePanel, where it
              // always shares a row with Business Unit) instead of ballooning
              // whenever it happens to be alone.
              <Box sx={{ maxWidth: 280 }}>
                <Field label="Product Unit">
                  <Select
                    value={form.productUnit}
                    disabled={applying}
                    onChange={(e) => set("productUnit", String(e.target.value))}
                    displayEmpty
                    renderValue={(v) => (v === "" ? <Placeholder /> : productUnits[Number(v)] ?? String(v))}
                  >
                    {unitGroups.flatMap(([bu, items]) => [
                      // Full-opacity heading colour instead of MUI's dim
                      // default text.secondary, which read as low-contrast
                      // grey-on-dark.
                      <ListSubheader
                        key={`h-${bu}`}
                        // A group with few items lets the next sticky header
                        // overtake it mid-scroll, overlapping its text with the
                        // item still scrolling out underneath. Disabling sticky
                        // entirely removes the only thing that can collide.
                        disableSticky
                        // The flat #8a8a8a this used to carry read as a plain
                        // grey, out of step with every other surface in the
                        // dialog — those come from the warm `action.hover`
                        // tint (CcApproveDetail.tsx:67's description/amount
                        // card uses the same token), which resolves through
                        // MUI's CSS-variables colour-scheme system automatically,
                        // unlike theme.palette.mode (confirmed dead here: it
                        // never reflects the live DOM colour-scheme attribute).
                        sx={{
                          bgcolor: "action.hover",
                          // text.primary, not ListSubheader's default
                          // text.secondary — a dim label reads poorly as a
                          // group heading.
                          color: "text.primary",
                          // MUI's ListSubheader bolds itself by default (its own
                          // built-in CSS, not something added here) — forced
                          // back to normal weight to match plain body text.
                          fontWeight: 400,
                        }}
                      >
                        {bu}
                      </ListSubheader>,
                      ...items.map((o) => (
                        // Indented under its group header so each option
                        // reads clearly as belonging to the business unit
                        // above it.
                        <MenuItem key={o.i} value={String(o.i)} sx={{ pl: 4 }}>
                          {o.label}
                        </MenuItem>
                      )),
                    ])}
                  </Select>
                </Field>
              </Box>
            )}
            {showSubRegion && (
              <Field label="Sub Region">
                <Select
                  value={form.subRegion}
                  disabled={applying}
                  onChange={(e) => set("subRegion", String(e.target.value))}
                  displayEmpty
                  renderValue={(v) => (v ? String(v) : <Placeholder />)}
                >
                  {subRegions.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </Field>
            )}
          </FieldRow>

          {error && <Alert severity="error" sx={{ fontSize: 12.5 }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="small" variant="outlined" onClick={close} disabled={applying}>
          Close
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => void apply()}
          disabled={applying || jobBlocked}
        >
          {applying ? "Applying…" : "Apply"}
        </Button>
      </DialogActions>

      <Dialog open={fundingOpen} onClose={() => setFundingOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
          Funding Sources
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 400 }}>
            What the selected transactions cost each share of the job.
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <FundingSources sources={fundingSources} totalAmount={selectionAmount} />
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setFundingOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
