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

import { findExactProductUnitIndex } from "./ccPendingSubmissions";
import {
  CC_COMMENT_MAX,
  type CcExpenseTypeList,
  type CcProductAndBusinessUnitList,
  type CcTaggingRule,
  type CcTaggingRuleInput,
  type CcTaggingRulePatch,
  isMarketingCategory,
  isTravelCategory,
} from "./ccTypes";

/** The highest amount a rule's range can name. */
export const RULE_AMOUNT_MAX = 1_000_000;
/** The most characters a rule's supplier can have. */
export const RULE_SUPPLIER_MAX = 50;
/** The most characters a rule's account can have. */
export const RULE_ACCOUNT_MAX = 100;

/** A non-negative amount with up to 2 decimal places. */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** An amount part-way through being typed: digits, then at most one point and 2 decimals. */
const AMOUNT_DRAFT_PATTERN = /^\d*\.?\d{0,2}$/;

/** Whether an amount field may take this text, so anything but digits and one point is kept out. */
export function isAmountDraft(v: string): boolean {
  return AMOUNT_DRAFT_PATTERN.test(v);
}

/** A typed amount as it reads once the field is left: to 2 decimal places, or blank if nothing was typed. */
export function formatAmount(v: string): string {
  if (!isAmountDraft(v)) return v;
  return v === "" || v === "." ? "" : Number(v).toFixed(2);
}

/** A rule as the form holds it: every value as typed, with blank for none. */
export interface CcRuleForm {
  /** The card's last digits. */
  ccNumber: string;
  /** Matches any bill supplier that contains it. */
  supplier: string;
  /** The account on the bill. Blank matches bills that show no account. */
  account: string;
  /** The lowest bill amount matched, inclusive. */
  amountMin: string;
  /** The bill amount matched up to, exclusive. */
  amountMax: string;
  /** The expense category filled in. */
  expenseCategoryLabel: string;
  /** The expense type filled in. */
  expenseTypeLabel: string;
  /** The transaction comment filled in. */
  comment: string;
  /** The sub region filled in. */
  subRegion: string;
  /** The product unit filled in. */
  productUnit: string;
  /** The business unit filled in. */
  businessUnit: string;
  /** Whether the rule is applied. */
  active: boolean;
}

/**
 * The form for a new rule.
 *
 * @param ccNumber - The card to start on, if any.
 */
export function emptyRuleForm(ccNumber = ""): CcRuleForm {
  return {
    ccNumber,
    supplier: "",
    account: "",
    amountMin: "",
    amountMax: "",
    expenseCategoryLabel: "",
    expenseTypeLabel: "",
    comment: "",
    subRegion: "",
    productUnit: "",
    businessUnit: "",
    active: true,
  };
}

/** The form for an existing rule. */
export function ruleToForm(r: CcTaggingRule): CcRuleForm {
  return {
    ccNumber: r.ccNumber,
    supplier: r.supplier,
    account: r.account ?? "",
    amountMin: r.amountMin == null ? "" : r.amountMin.toFixed(2),
    amountMax: r.amountMax == null ? "" : r.amountMax.toFixed(2),
    expenseCategoryLabel: r.expenseCategoryLabel ?? "",
    expenseTypeLabel: r.expenseTypeLabel ?? "",
    comment: r.comment ?? "",
    subRegion: r.subRegion ?? "",
    productUnit: r.productUnit ?? "",
    businessUnit: r.businessUnit ?? "",
    active: r.active,
  };
}

const text = (v: string): string | null => v.trim() || null;
const amount = (v: string): number | null => (v.trim() ? Number(v) : null);

/** The form as the body that adds a rule: text trimmed, blanks as `null` and amounts as numbers. */
export function toRuleInput(f: CcRuleForm): CcTaggingRuleInput {
  return {
    ccNumber: f.ccNumber.trim(),
    supplier: f.supplier.trim(),
    account: text(f.account),
    amountMin: amount(f.amountMin),
    amountMax: amount(f.amountMax),
    expenseCategoryLabel: text(f.expenseCategoryLabel),
    expenseTypeLabel: text(f.expenseTypeLabel),
    comment: text(f.comment),
    subRegion: text(f.subRegion),
    productUnit: text(f.productUnit),
    businessUnit: text(f.businessUnit),
    active: f.active,
  };
}

/**
 * The fields of the form that differ from the rule, as the body that changes it. Empty when
 * nothing changed. A change to Active alone gives exactly `{ active }`, which the backend applies
 * without checking the rule's other values.
 */
export function rulePatch(rule: CcTaggingRule, f: CcRuleForm): CcTaggingRulePatch {
  const before = toRuleInput(ruleToForm(rule));
  const after = toRuleInput(f);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof CcTaggingRuleInput)[]) {
    if (after[key] !== before[key]) patch[key] = after[key];
  }
  return patch as CcTaggingRulePatch;
}

/**
 * Whether a change is to Active alone. The backend saves such a change without checking the
 * rule's other values, so it needs no form errors cleared first.
 */
export function isActiveOnly(patch: CcTaggingRulePatch): boolean {
  const keys = Object.keys(patch);
  return keys.length === 1 && keys[0] === "active";
}

/** Why an amount can't be sent, or `null` when it can. */
function amountError(v: string): string | null {
  if (!v.trim()) return null;
  if (!AMOUNT_PATTERN.test(v.trim())) return "Enter 0 or more, with up to 2 decimal places.";
  if (Number(v) > RULE_AMOUNT_MAX) return `Enter at most ${RULE_AMOUNT_MAX.toLocaleString("en-US")}.`;
  return null;
}

/** The error for text longer than `max`, or `null`. */
const lengthError = (v: string, max: number): string | null =>
  v.trim().length > max ? `Use at most ${max} characters.` : null;

/**
 * The form's errors by field: a missing card or supplier, text too long, an amount that isn't 0 or
 * more with up to 2 decimal places or is above `RULE_AMOUNT_MAX`, a minimum not below the maximum,
 * and a category, type or unit picked without its other half. Whether a value is still offered is
 * left to `outdatedFields`.
 *
 * @param f - The form.
 * @param isAuto - Whether the rule was added by the system. Its card, supplier and account can't
 *   be changed, so they aren't checked.
 */
export function ruleFormErrors(f: CcRuleForm, isAuto: boolean): Partial<Record<keyof CcRuleForm, string>> {
  const errors: Partial<Record<keyof CcRuleForm, string | null>> = {};
  if (!isAuto) {
    errors.ccNumber = f.ccNumber.trim() ? null : "Pick a card.";
    errors.supplier = f.supplier.trim() ? lengthError(f.supplier, RULE_SUPPLIER_MAX) : "Enter the supplier.";
    errors.account = lengthError(f.account, RULE_ACCOUNT_MAX);
  }
  errors.amountMin = amountError(f.amountMin);
  errors.amountMax = amountError(f.amountMax);
  if (!errors.amountMin && !errors.amountMax && f.amountMin.trim() && f.amountMax.trim()
    && Number(f.amountMin) >= Number(f.amountMax)) {
    errors.amountMin = "Must be below the maximum.";
  }
  if (f.expenseCategoryLabel && !f.expenseTypeLabel) errors.expenseTypeLabel = "Pick the expense type.";
  if (!f.expenseCategoryLabel && f.expenseTypeLabel) errors.expenseCategoryLabel = "Pick the expense category.";
  if (!f.productUnit !== !f.businessUnit) errors.productUnit = "Pick the Product and Business Unit.";
  errors.comment = lengthError(f.comment, CC_COMMENT_MAX);
  return Object.fromEntries(Object.entries(errors).filter(([, e]) => e)) as Partial<Record<keyof CcRuleForm, string>>;
}

/** The menus a rule's values are checked against. One not yet loaded is left out. */
export interface CcRuleMenus {
  /** The expense categories, and the types of each. */
  expenseTypes?: CcExpenseTypeList;
  /** The sub regions. */
  subRegions?: string[];
  /** The product and business unit pairs. */
  units?: CcProductAndBusinessUnitList;
}

/**
 * The form's values that the menus no longer offer. An empty value, or one whose menu isn't
 * loaded, is never flagged. A category no longer offered also flags its type, and a product and
 * business unit pair not offered together flags both.
 */
export function outdatedFields(f: CcRuleForm, menus: CcRuleMenus): Partial<Record<keyof CcRuleForm, true>> {
  const out: Partial<Record<keyof CcRuleForm, true>> = {};
  const { expenseTypes, subRegions, units } = menus;
  if (expenseTypes && f.expenseCategoryLabel) {
    const types = expenseTypes.categories.includes(f.expenseCategoryLabel)
      ? expenseTypes.types[f.expenseCategoryLabel] ?? []
      : null;
    if (!types) out.expenseCategoryLabel = true;
    if (f.expenseTypeLabel && !types?.includes(f.expenseTypeLabel)) out.expenseTypeLabel = true;
  }
  if (subRegions && f.subRegion && !subRegions.includes(f.subRegion)) out.subRegion = true;
  if (units && (f.productUnit || f.businessUnit)
    && findExactProductUnitIndex(f.productUnit, f.businessUnit, units.productUnits, units.businessUnits) === null) {
    if (f.productUnit) out.productUnit = true;
    if (f.businessUnit) out.businessUnit = true;
  }
  return out;
}

/** Which detail fields a category takes. */
export interface CcRuleDetailFields {
  /** Whether it takes a sub region. */
  subRegion: boolean;
  /** Whether it takes a product and business unit. */
  units: boolean;
  /** Whether to note that the Travel Job Number is left for the card holder. */
  travelNote: boolean;
}

/** Which detail fields a rule with this category takes. */
export function ruleDetailFields(category: string): CcRuleDetailFields {
  if (isTravelCategory(category)) return { subRegion: false, units: false, travelNote: true };
  return { subRegion: isMarketingCategory(category), units: true, travelNote: false };
}

/** The form with every field its category doesn't show cleared, so nothing hidden is checked or kept. */
export function withoutHiddenFields(f: CcRuleForm): CcRuleForm {
  const shown = ruleDetailFields(f.expenseCategoryLabel);
  return {
    ...f,
    subRegion: shown.subRegion ? f.subRegion : "",
    productUnit: shown.units ? f.productUnit : "",
    businessUnit: shown.units ? f.businessUnit : "",
  };
}

/** What saving the rule form does: close, stay blocked, add a rule, or change one. */
export type CcRuleSave =
  | { kind: "close" }
  | { kind: "blocked" }
  | { kind: "add"; input: CcTaggingRuleInput }
  | { kind: "update"; patch: CcTaggingRulePatch };

/**
 * What saving the form does. Nothing changed closes it. A change to Active alone is sent even
 * while blocked, since the backend checks nothing else for it. Otherwise a blocked form stays
 * blocked, and a valid one is sent without its hidden fields, which clears values a category no
 * longer shows.
 *
 * @param rule - The rule being edited, or `null` when adding.
 * @param f - The form.
 * @param blocked - Whether the form has errors or values no longer offered, or can't yet be checked.
 */
export function ruleSave(rule: CcTaggingRule | null, f: CcRuleForm, blocked: boolean): CcRuleSave {
  if (!rule) return blocked ? { kind: "blocked" } : { kind: "add", input: toRuleInput(withoutHiddenFields(f)) };
  const patch = rulePatch(rule, f);
  if (Object.keys(patch).length === 0) return { kind: "close" };
  if (isActiveOnly(patch)) return { kind: "update", patch };
  if (blocked) return { kind: "blocked" };
  return { kind: "update", patch: rulePatch(rule, withoutHiddenFields(f)) };
}
