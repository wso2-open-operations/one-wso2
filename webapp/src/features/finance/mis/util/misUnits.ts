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

// Which slice of the business a Build is a Build OF.
//
// Four categories — business units, the software lines, the cloud lines, and a
// set the reader assembles themselves — and the codes under each. Ported from
// `CATEGORY_SUBS`, `defaultAllCode` and `formatUnitLabel` in digiops-finance
// `arrDashboard/components/TableNavigation.js`.
//
// Two vocabularies meet in this file and must not be confused:
//
//   the SELECTION code   `BU_APIM`, and `CUSTOM`. What a link carries as
//                        `unit=bu-apim`, and what the URL contract validates
//                        with `UNIT_CODE_PATTERN`.
//   the BACKEND code     `APIM_BU`. What `/arr-summary` wants in
//                        `businessUnits`, and what `/app-configs` answers with
//                        for the two custom lists.
//
// They are reversed on purpose, and `misArrSummaryRequest.ts` owns the
// translation between them. Everything above `MIS_UNITS_BY_CATEGORY` here is
// the first kind; `formatUnitLabel` alone is about the second.

import { CUSTOM_UNIT } from "./misViewVocabulary";

export const MIS_UNIT_CATEGORIES = ["BU", "Software", "Cloud", "Custom"] as const;
export type MisUnitCategory = (typeof MIS_UNIT_CATEGORIES)[number];

/** The tab labels. "Build" is the finance term — see CONTEXT.md, not `npm run build`. */
export const MIS_UNIT_CATEGORY_LABELS: Readonly<Record<MisUnitCategory, string>> = {
  BU: "BU Build",
  Software: "Software Build",
  Cloud: "Cloud Build",
  Custom: "Custom Build",
};

export interface MisUnit {
  /** The selection code, as a link carries it. */
  code: string;
  label: string;
}

/**
 * The units each category offers, in the source's own order — every list
 * ending with the whole category rather than leading with it, so the narrower
 * choices come first and "All" is the fallback at the end.
 *
 * The labels are the source's too, and they are NOT uniform: a BU reads as the
 * bare product name because the tab above already says BU, while a cloud line
 * reads as the products it covers, which is information the tab cannot carry.
 */
export const MIS_UNITS_BY_CATEGORY: Readonly<
  Record<Exclude<MisUnitCategory, "Custom">, readonly MisUnit[]>
> = {
  BU: [
    { code: "BU_APIM", label: "API Platform" },
    { code: "BU_IAM", label: "IAM" },
    { code: "BU_INTEGRATION", label: "Integration" },
    { code: "BU_CHOREO", label: "Choreo" },
    { code: "BU_AGENT_PLATFORM", label: "Agent Platform" },
    { code: "BU_ALL", label: "All" },
  ],
  Software: [
    { code: "SW_APIM", label: "API Platform Software" },
    { code: "SW_IAM", label: "IAM Software" },
    { code: "SW_INTEGRATION", label: "Integration Software" },
    { code: "SW_ALL", label: "All Software" },
  ],
  Cloud: [
    { code: "CL_APIM", label: "API Platform Private Cloud + Bjira" },
    { code: "CL_IAM", label: "IAM Private Cloud + Asgardeo" },
    { code: "CL_INTEGRATION", label: "Integration Private Cloud + Devant" },
    { code: "CL_CHOREO", label: "Choreo" },
    { code: "CL_AGENT_PLATFORM", label: "Agent Platform" },
    { code: "CL_MOESIF", label: "Moesif" },
    { code: "CL_ALL", label: "All Cloud" },
  ],
};

/** The code a category opens on: the whole of it. */
export function defaultUnitCode(category: MisUnitCategory): string {
  if (category === "Custom") return CUSTOM_UNIT;
  return MIS_UNITS_BY_CATEGORY[category].at(-1)?.code ?? "BU_ALL";
}

/**
 * Which tab a selection belongs under.
 *
 * The prefix is the answer rather than a lookup, because the codes come from
 * `/app-configs` at runtime: a unit added tomorrow reaches a release shipped
 * today, and it should land on the right tab without this file knowing its name.
 */
export function unitCategoryOf(code: string): MisUnitCategory {
  if (code === CUSTOM_UNIT) return "Custom";
  if (code.startsWith("SW_")) return "Software";
  if (code.startsWith("CL_")) return "Cloud";
  return "BU";
}

/**
 * The names Finance uses for backend codes that do not carry them.
 *
 * `APIM_CLOUD` is not "Apim Cloud" — it is the line that covers the private
 * cloud and Bjira, and a reader choosing units for a revenue report needs to
 * know which. Verbatim from `TableNavigation.js:153-163`.
 */
const UNIT_LABEL_OVERRIDES: Readonly<Record<string, string>> = {
  APIM_BU: "API Platform BU",
  APIM_SOFTWARE: "API Platform Software",
  APIM_CLOUD: "API Platform Private Cloud + Bjira",
  IAM_CLOUD: "IAM Private Cloud + Asgardeo",
  INTEGRATION_CLOUD: "Integration Private Cloud + Devant",
  CHOREO_CLOUD: "Choreo",
  AGENT_PLATFORM_BU: "Agent Platform BU",
  AGENT_PLATFORM_CLOUD: "Agent Platform",
  MOESIF_CLOUD: "Moesif",
};

/** Words that are shouted rather than title-cased. */
const ACRONYMS: ReadonlySet<string> = new Set([
  "API", "IAM", "AWS", "URL", "BU", "SW", "CL", "HTML", "XML", "SQL",
]);

/**
 * What to call a backend unit code on screen.
 *
 * The two custom chip lists are the only place these codes are shown to anyone,
 * and they are shown unsorted by the source and sorted by this port.
 *
 * One departure from the source, in a branch nothing reaches: it normalises the
 * code (trim, upper-case, spaces to underscores) to look up an override, then
 * title-cases the RAW string if there is none — so a value with a space in it
 * comes back half-cased. Every code the backend sends is already underscored, so
 * the branch cannot fire today; the normalised value is used throughout here
 * rather than reproducing a typo that only a future backend could expose.
 */
export function formatUnitLabel(code: string): string {
  const normalised = String(code ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!normalised) return "";
  const override = UNIT_LABEL_OVERRIDES[normalised];
  if (override) return override;
  return normalised
    .split("_")
    .map((word) => (ACRONYMS.has(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(" ");
}
