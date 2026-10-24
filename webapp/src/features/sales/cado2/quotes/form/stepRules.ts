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

// What each wizard step needs before the AM may move on (F5 feedback,
// 2026-09-25): the wizard is filled in order, and Next unlocks only when the
// current step is complete. The checks mirror the backend's submit checks
// (quote/completeness.go) for steps 1–3, so the lock reacts as the AM types.
//
// Decided 2026-09-25: problems only Salesforce can fix (no Direct /
// Partner value, no primary partner) block Next too. Accepted risk: an AM can
// get stuck on bad Salesforce data; revisit if it is reported.

import type { AddressValue, ContactValue, DraftFormValues } from "./draftForm";
import { isEmptyLegalText } from "@features/sales/cado2/utils/legalRichText";
import { commissionProblem, formYears, isPartnerLed, lastYearEndProblem, lineDatesProblem } from "./draftForm";

/** The to-do when the billing says "See Special Terms" and they are off (D86), as the backend words it. */
export const SPECIAL_TERMS_BILLING = "Billing says See Special Terms: switch on special terms and describe the billing";

export interface StepCheck {
  /** The backend field it corresponds to, so the step can mark it. */
  readonly field: string;
  readonly message: string;
}

const hasContact = (c: ContactValue) =>
  (c.mode === "salesforce" && Boolean(c.sfContactId)) || (c.mode === "manual" && c.name.trim() !== "");

const addressComplete = (a: AddressValue) =>
  Boolean(a.companyName.trim() && a.addressLine1.trim() && a.city.trim() && a.country.trim());

/** Missing items per step: [Overview, Products & Pricing, Commercials, Legal]. Review has none of its own. */
export function stepChecks(
  v: DraftFormValues,
): [StepCheck[], StepCheck[], StepCheck[], StepCheck[]] {
  const overview: StepCheck[] = [];
  const need = (list: StepCheck[], ok: boolean, field: string, message: string) => {
    if (!ok) list.push({ field, message });
  };
  need(overview, Boolean(v.accountId), "sfAccountId", "Choose the account");
  // Approvals will route on the region (2026-10-07): no quote without it.
  if (v.accountId) need(overview, Boolean(v.accountSalesRegion), "salesRegion", "The account has no sales region in Salesforce");
  need(overview, Boolean(v.opportunityId), "sfOpportunityId", "Choose the opportunity");
  if (v.opportunityId) {
    need(overview, v.dealType !== null, "dealType", "The opportunity has no Direct / Partner value in Salesforce");
    if (v.dealType === "PARTNER") need(overview, Boolean(v.partner?.id), "partner", "The partner deal has no primary partner in Salesforce");
  }
  need(overview, Boolean(v.legalEntityId), "legalEntityId", "Choose the WSO2 legal entity");

  const products: StepCheck[] = [];
  // The start date comes first on Products & Pricing (D73).
  need(products, Boolean(v.startDate), "subscriptionStartDate", "Choose the start date");
  // The currency sits with the price book on Products & Pricing.
  need(products, Boolean(v.currencyIsoCode), "currencyIsoCode", "Choose the currency");
  need(products, v.lines.length > 0, "lines", "Add at least one product");
  // Products brought in from the opportunity wait for a category when unmapped (D72).
  const uncategorised = v.lines.filter((l) => !l.category).length;
  need(
    products,
    uncategorised === 0,
    "lines",
    uncategorised === 1 ? "Choose the category of 1 product" : `Choose the category of ${uncategorised} products`,
  );
  // The contract years: at least Year 1, the last
  // year's end within it, and every product's dates within its own year.
  need(products, v.yearCount > 0, "years", "Add Year 1");
  const lastProblem = lastYearEndProblem(v.startDate, v.yearCount, v.lastYearEndDate);
  need(products, !lastProblem, "lastYearEndDate", lastProblem);
  const years = formYears(v);
  v.lines.forEach((l, i) => {
    const problem = lineDatesProblem(l, years);
    need(products, !problem, `lines[${i}].startDate`, problem);
  });

  // Partner-led: the partner's commission, 0 allowed.
  if (isPartnerLed(v) && v.lines.length > 0) {
    const problem = commissionProblem(v.partnerCommissionPercent);
    need(products, !problem, "partnerCommissionPercent", problem);
  }
  const commercial: StepCheck[] = [];
  // Commercials opens with billing and payment terms (D86), on every quote (D88).
  need(commercial, Boolean(v.billingFrequency), "billingFrequency", "Choose the billing frequency");
  need(commercial, Boolean(v.netTermsDays), "netTermsDays", "Choose the payment terms");
  need(commercial, addressComplete(v.billTo), "billTo", "Complete the bill-to address (company, street, city, country)");
  const shipNeeded = v.dealType === "PARTNER" || !v.shipToSameAsBillTo;
  need(commercial, !shipNeeded || addressComplete(v.shipTo), "shipTo", "Complete the ship-to address (company, street, city, country)");
  need(commercial, hasContact(v.billingContact), "contacts.billing", "Choose the billing contact");

  // Legal: the special terms (D86's "See Special Terms"
  // billing points at them) and, on a partner deal, its agreement. The
  // non-standard switches need nothing: Legal writes those terms.
  const legalStep: StepCheck[] = [];
  need(
    legalStep,
    v.billingFrequency !== "SPECIAL_TERMS" || v.specialTermsEnabled,
    "specialTerms.billing",
    SPECIAL_TERMS_BILLING,
  );
  need(legalStep, !v.specialTermsEnabled || !isEmptyLegalText(v.specialTerms), "specialTerms.text", "Write the special terms, or switch them off");
  if (v.dealType === "PARTNER") {
    need(legalStep, v.partnerContractName.trim() !== "", "partnerContractName", "Choose the partner agreement");
    need(legalStep, v.partnerContractDate !== "", "partnerContractDate", "Enter the date of the partner agreement");
  }

  return [overview, products, commercial, legalStep];
}

/**
 * The furthest step the AM may open: the first incomplete step (they are
 * filled in order), or Review when steps 1–4 are all complete. `extra` adds
 * problems found elsewhere, e.g. lines the live pricing refused.
 */
export function reachableStep(checks: readonly (readonly StepCheck[])[], extra: readonly number[] = []): number {
  for (let i = 0; i < 4; i++) if ((checks[i]?.length ?? 0) + (extra[i] ?? 0) > 0) return i;
  return 4;
}

/** "Choose the billing frequency" or "Choose the currency (+2 more)". */
export function nextHint(checks: readonly StepCheck[]): string {
  if (checks.length === 0) return "";
  return checks.length === 1 ? checks[0].message : `${checks[0].message} (+${checks.length - 1} more)`;
}
