/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  type Theme,
  Typography,
} from "@wso2/oxygen-ui";
import { InfoIcon } from "@wso2/oxygen-ui-icons-react";
import { type ReactNode, useId, useState } from "react";
import { CC_RULE_SNACK, describeRuleError } from "./ccCopy";
import {
  Field,
  FieldLabel,
  FieldRow,
  NoLongerOffered,
  Placeholder,
  ProductUnitSelect,
  SearchableSelect,
} from "./ccFormFields";
import { clearDependentFields, findExactProductUnitIndex } from "./ccPendingSubmissions";
import {
  type CcRuleForm,
  emptyRuleForm,
  formatAmount,
  isAmountDraft,
  outdatedFields,
  ruleDetailFields,
  ruleFormErrors,
  ruleSave,
  ruleToForm,
  withoutHiddenFields,
} from "./ccTaggingRuleForm";
import {
  CC_COMMENT_MAX,
  type CcCreditCard,
  type CcExpenseTypeList,
  type CcProductAndBusinessUnitList,
  type CcTaggingRule,
  ccCardIsActive,
  ccHolderCardName,
  ccRuleUnconfigured,
} from "./ccTypes";
import { useCcMenus, useCcOwnCards } from "./useCc";
import { useCcCreateTaggingRule, useCcUpdateTaggingRule } from "./useCcMutations";

/** Under a field whose stored value the menus no longer offer. */
const STALE_HELP = "No longer offered. Pick a current value.";

const TRAVEL_NOTE = "The Travel Job Number can't be set in a rule, as it differs every time.";

/** The form fields a category change clears, from the same rule the transaction form follows. */
const CLEARED_BY_CATEGORY = Object.fromEntries(
  Object.keys(clearDependentFields("expenseCategory"))
    .filter((k) => k in emptyRuleForm())
    .map((k) => [k, ""]),
) as Partial<CcRuleForm>;

/** How opaque the theme draws a dialog's paper (`#ffffffc5`, `#000000c5`). */
const PAPER_OPACITY = "77%";

/**
 * The theme's dialog paper is translucent, so in a light theme it turns grey over the dimmed page,
 * and opaque alerts on it make the form around them look disabled. Alerts here are drawn as
 * translucent as the paper instead.
 */
const SEE_THROUGH_ALERTS_SX = Object.fromEntries(
  (["error", "warning", "info", "success"] as const).map((s) => [
    `& .MuiAlert-standard${s[0].toUpperCase()}${s.slice(1)}`,
    {
      backgroundColor: (t: Theme) =>
        `color-mix(in srgb, ${t.vars?.palette.Alert[`${s}StandardBg`]} ${PAPER_OPACITY}, transparent)`,
    },
  ]),
);

/** Help under a field, and the Travel note, read as quietly as the field labels; an error keeps its colour. */
const QUIET_HELP_SX = { color: "text.disabled" };

/** A card's number in the card list, set apart so the numbers line up down the list. */
const CARD_NUMBER_SX = { fontFamily: "monospace", fontSize: 13, color: "text.secondary" };

/**
 * Adds an autofill rule, or configures or edits one. A system rule's card, supplier and account
 * come from a bill and are locked. Values the menus no longer offer are shown as stored and marked;
 * the rule can't be saved until they are replaced or cleared, except to switch it on or off.
 */
export function CcTaggingRuleDialog({
  rule,
  onClose,
}: {
  /** The rule to edit, or `null` to add one. */
  rule: CcTaggingRule | null;
  /** Called when the dialog is done, saved or not. */
  onClose: () => void;
}) {
  const ownCards = useCcOwnCards();
  const menus = useCcMenus();
  const create = useCcCreateTaggingRule();
  const update = useCcUpdateTaggingRule();
  const { showSuccess } = useNotifications();
  const titleId = useId();

  const [form, setForm] = useState<CcRuleForm>(() => (rule ? ruleToForm(rule) : emptyRuleForm()));
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());

  const isAuto = rule?.source === "auto";
  const mutation = rule ? update : create;
  const pending = mutation.isPending;

  // A card holder adding a rule with one active card has nothing to pick.
  const activeCards = ownCards.cards.filter(ccCardIsActive);
  const current: CcRuleForm = {
    ...form,
    ccNumber: form.ccNumber || (!rule && activeCards.length === 1 ? activeCards[0].ccNumber : ""),
  };

  const expenseTypes = menus.expenseTypes.data;
  const subRegions = menus.subRegions.data?.subRegions;
  const units = menus.units.data;
  const menusReady = Boolean(expenseTypes && subRegions && units);
  const menuFailure = [menus.expenseTypes, menus.subRegions, menus.units].find((q) => q.isError);

  // Only what the category shows is checked; a save clears the rest.
  const shown = withoutHiddenFields(current);
  const stale = outdatedFields(shown, { expenseTypes, subRegions, units });
  const errors = ruleFormErrors(shown, isAuto);
  const blocked = !menusReady || Object.keys(stale).length > 0 || Object.keys(errors).length > 0;
  const outcome = ruleSave(rule, current, blocked);

  const change = (patch: Partial<CcRuleForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setEdited((e) => new Set([...e, ...Object.keys(patch)]));
  };
  const done = (message: string) => () => {
    showSuccess(message);
    onClose();
  };

  const handleSave = () => {
    if (outcome.kind === "add") create.mutate(outcome.input, { onSuccess: done(CC_RULE_SNACK.created) });
    else if (outcome.kind === "update" && rule) {
      update.mutate({ id: rule.id, patch: outcome.patch }, { onSuccess: done(CC_RULE_SNACK.updated) });
    }
  };

  const title = !rule ? "Add Rule" : rule.active && ccRuleUnconfigured(rule) ? "Configure Rule" : "Edit Rule";
  // A stored rule's own values are checked from the start; a new rule's fields once they're edited.
  const shownErrors = rule
    ? errors
    : (Object.fromEntries(Object.entries(errors).filter(([k]) => edited.has(k))) as typeof errors);
  const canSave = !pending && (outcome.kind === "add" || outcome.kind === "update");

  return (
    <Dialog
      open
      onClose={pending ? undefined : onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: SEE_THROUGH_ALERTS_SX } }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {mutation.isError && <Alert severity="error">{describeRuleError(mutation.error)}</Alert>}
          {ownCards.isError && (
            <ErrorNotice error={ownCards.error} onRetry={ownCards.retry} retrying={ownCards.isFetching}>
              Couldn&apos;t load your cards.
            </ErrorNotice>
          )}
          {menuFailure && (
            <ErrorNotice
              error={menuFailure.error}
              onRetry={() => void menuFailure.refetch()}
              retrying={menuFailure.isFetching}
            >
              Couldn&apos;t load the expense options.
            </ErrorNotice>
          )}

          <Section title="Match">
            <FieldRow>
              <Field label="Card" required={!isAuto}>
                <CardSelect
                  value={current.ccNumber}
                  cards={activeCards}
                  rule={rule}
                  allCards={ownCards.cards}
                  disabled={isAuto || ownCards.isLoading}
                  error={Boolean(shownErrors.ccNumber)}
                  onChange={(ccNumber) => change({ ccNumber })}
                />
                <Help error={shownErrors.ccNumber} />
              </Field>
              <TextInput
                label="Supplier"
                required={!isAuto}
                value={current.supplier}
                disabled={isAuto}
                error={shownErrors.supplier}
                help={isAuto ? undefined : "Matches bills containing this supplier name."}
                onChange={(supplier) => change({ supplier })}
              />
              <TextInput
                label="Account"
                value={current.account}
                disabled={isAuto}
                error={shownErrors.account}
                help={isAuto ? undefined : "Leave empty for bills without an account."}
                onChange={(account) => change({ account })}
              />
            </FieldRow>
            <FieldRow>
              <TextInput
                label="Min Amount ($)"
                value={current.amountMin}
                amount
                error={shownErrors.amountMin}
                help="Included"
                onChange={(amountMin) => change({ amountMin })}
              />
              <TextInput
                label="Max Amount ($)"
                value={current.amountMax}
                amount
                error={shownErrors.amountMax}
                help="Not included"
                onChange={(amountMax) => change({ amountMax })}
              />
            </FieldRow>
          </Section>

          <Section title="Fill in">
            <RuleDetails
              form={current}
              stale={stale}
              errors={shownErrors}
              expenseTypes={expenseTypes}
              subRegions={subRegions}
              units={units}
              onChange={change}
            />
          </Section>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* A new rule is meant to apply, so only an existing one can be switched off or back on. */}
        {rule && (
          <FormControlLabel
            control={<Switch checked={current.active} onChange={(e) => change({ active: e.target.checked })} />}
            label="Active"
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={pending} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave}
          startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {rule ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * The card to match. Lists the active cards; when editing, the rule's own card stays listed even
 * once it's inactive, and its stored number shows while the cards load or if it isn't listed.
 */
function CardSelect({
  value,
  cards,
  allCards,
  rule,
  disabled,
  error,
  onChange,
  labelId,
}: {
  value: string;
  /** The active cards. */
  cards: CcCreditCard[];
  /** Every card of the card holder's, to find the rule's own card among. */
  allCards: CcCreditCard[];
  rule: CcTaggingRule | null;
  disabled: boolean;
  error: boolean;
  onChange: (ccNumber: string) => void;
  /** The id of the label naming the select, which {@link Field} passes in. */
  labelId?: string;
}) {
  const ruleCard = rule && allCards.find((c) => c.id === rule.creditCardId);
  const option = (c: CcCreditCard) => {
    const name = ccHolderCardName(c, cards);
    return { value: c.ccNumber, name, label: `${name} (${c.ccNumber})` };
  };
  const options = cards.map(option);
  if (rule && !options.some((o) => o.value === rule.ccNumber)) {
    options.push(ruleCard ? option(ruleCard) : { value: rule.ccNumber, name: "", label: rule.ccNumber });
  }
  return (
    <Select
      labelId={labelId}
      value={options.some((o) => o.value === value) ? value : ""}
      disabled={disabled}
      error={error}
      onChange={(e) => onChange(String(e.target.value))}
      displayEmpty
      renderValue={(v) => options.find((o) => o.value === v)?.label ?? <Placeholder />}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} sx={{ justifyContent: "space-between", gap: 2 }}>
          <span>{o.name}</span>
          <Box component="span" sx={CARD_NUMBER_SX}>
            {o.value}
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
}

/** The expense details a rule fills in, with the fields its category takes. */
function RuleDetails({
  form,
  stale,
  errors,
  expenseTypes,
  subRegions,
  units,
  onChange,
}: {
  form: CcRuleForm;
  /** The fields whose stored value the menus no longer offer. */
  stale: Partial<Record<keyof CcRuleForm, true>>;
  /** The errors to show, by field. */
  errors: Partial<Record<keyof CcRuleForm, string>>;
  expenseTypes: CcExpenseTypeList | undefined;
  subRegions: string[] | undefined;
  units: CcProductAndBusinessUnitList | undefined;
  onChange: (patch: Partial<CcRuleForm>) => void;
}) {
  const details = ruleDetailFields(form.expenseCategoryLabel);
  const productUnits = units?.productUnits ?? [];
  const businessUnits = units?.businessUnits ?? [];
  const staleUnits = stale.productUnit || stale.businessUnit;
  const unitIndex = findExactProductUnitIndex(form.productUnit || null, form.businessUnit, productUnits, businessUnits);
  const storedUnits = { productUnit: form.productUnit, businessUnit: form.businessUnit };

  return (
    <>
      <FieldRow>
        <Field label="Expense Category">
          <SearchableSelect
            value={form.expenseCategoryLabel}
            options={expenseTypes?.categories ?? []}
            unavailable={stale.expenseCategoryLabel ? form.expenseCategoryLabel : undefined}
            onChange={(v) => onChange({ expenseCategoryLabel: v, ...CLEARED_BY_CATEGORY })}
          />
          <Help error={errors.expenseCategoryLabel} stale={stale.expenseCategoryLabel} />
        </Field>
        <Field label="Expense Type">
          <SearchableSelect
            value={form.expenseTypeLabel}
            options={expenseTypes?.types[form.expenseCategoryLabel] ?? []}
            disabled={!form.expenseCategoryLabel}
            unavailable={stale.expenseTypeLabel ? form.expenseTypeLabel : undefined}
            onChange={(v) => onChange({ expenseTypeLabel: v })}
          />
          <Help error={errors.expenseTypeLabel} stale={stale.expenseTypeLabel} />
        </Field>
      </FieldRow>

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <FieldLabel>Comment</FieldLabel>
          <FieldLabel>
            {form.comment.length}/{CC_COMMENT_MAX}
          </FieldLabel>
        </Stack>
        <TextField
          size="small"
          fullWidth
          value={form.comment}
          onChange={(e) => onChange({ comment: e.target.value.slice(0, CC_COMMENT_MAX) })}
          error={Boolean(errors.comment)}
          helperText={errors.comment}
          inputProps={{ "aria-label": "Comment", maxLength: CC_COMMENT_MAX }}
        />
      </Box>

      {details.travelNote && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", ...QUIET_HELP_SX }}>
          <InfoIcon size={16} aria-hidden />
          <Typography variant="caption">{TRAVEL_NOTE}</Typography>
        </Stack>
      )}
      {details.units && (
        <FieldRow>
          <Field label="Product Unit">
            {units ? (
              <ProductUnitSelect
                value={unitIndex}
                productUnits={productUnits}
                businessUnits={businessUnits}
                noneLabel="None"
                unavailable={staleUnits ? storedUnits : undefined}
                onChange={(i) =>
                  onChange({
                    productUnit: i === null ? "" : productUnits[i] ?? "",
                    businessUnit: i === null ? "" : businessUnits[i] ?? "",
                  })
                }
              />
            ) : (
              // The stored unit stays readable while the units load.
              <TextField
                size="small"
                value={form.productUnit}
                disabled
                inputProps={{ "aria-label": "Product Unit" }}
              />
            )}
            <Help error={errors.productUnit} stale={staleUnits} />
          </Field>
          <Field label="Business Unit">
            <TextField
              size="small"
              fullWidth
              value={form.businessUnit}
              placeholder="From the product unit"
              error={Boolean(stale.businessUnit)}
              InputProps={{ readOnly: true }}
              inputProps={{ "aria-label": "Business Unit" }}
            />
          </Field>
          {details.subRegion && (
            <Field label="Sub Region">
              <Select
                value={form.subRegion}
                error={Boolean(stale.subRegion)}
                onChange={(e) => onChange({ subRegion: String(e.target.value) })}
                displayEmpty
                renderValue={(v) => (v ? String(v) : <Placeholder />)}
              >
                <MenuItem value="">None</MenuItem>
                {stale.subRegion && (
                  <MenuItem value={form.subRegion} sx={{ color: "error.main" }}>
                    {form.subRegion}
                    <NoLongerOffered />
                  </MenuItem>
                )}
                {(subRegions ?? []).map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
              <Help stale={stale.subRegion} />
            </Field>
          )}
        </FieldRow>
      )}
    </>
  );
}

/** A titled group of fields. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{title}</Typography>
      {children}
    </Stack>
  );
}

/** The line under a select: its error, else a note that its stored value is no longer offered. */
function Help({ error, stale }: { error?: string; stale?: boolean }) {
  if (error) return <FormHelperText error>{error}</FormHelperText>;
  if (stale) return <FormHelperText error>{STALE_HELP}</FormHelperText>;
  return null;
}

/** A labelled text input, named by its label, with its error or else its help under it. */
function TextInput({
  label,
  value,
  onChange,
  required,
  disabled,
  amount,
  error,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Whether the value is an amount: digits and a point only, shown to 2 decimal places once left. */
  amount?: boolean;
  error?: string;
  help?: string;
}) {
  const id = useId();
  return (
    <Box>
      <FieldLabel>
        {label}
        {required && <Box component="span" sx={{ color: "error.main", ml: 0.25 }}>*</Box>}
      </FieldLabel>
      <TextField
        id={id}
        size="small"
        fullWidth
        value={value}
        disabled={disabled}
        onChange={(e) => {
          if (!amount || isAmountDraft(e.target.value)) onChange(e.target.value);
        }}
        onBlur={() => {
          if (amount && formatAmount(value) !== value) onChange(formatAmount(value));
        }}
        error={Boolean(error)}
        helperText={error ?? help}
        slotProps={{ formHelperText: { sx: error ? undefined : QUIET_HELP_SX } }}
        inputProps={{ "aria-label": label, inputMode: amount ? "decimal" : undefined }}
      />
    </Box>
  );
}
