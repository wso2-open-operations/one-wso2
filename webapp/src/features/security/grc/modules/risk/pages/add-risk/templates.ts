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
import type { LookupOption, RegisterTemplate, RiskEnvironment, RiskTeam } from "../../api/riskApi";
import type { AddRiskFormValues } from "./types";

// Register Templates (RISK_MODULE_DESIGN.md §14): which fields a risk carries
// depends on its source register's template, chosen by a platform admin when
// the register is added. The Risk Assigner never picks one — choosing a Source
// Register brings up that register's fields.

export const ENVIRONMENTS: { value: RiskEnvironment; label: string }[] = [
  { value: "PRODUCTION", label: "Production" },
  { value: "NON_PRODUCTION", label: "Non-Production" },
  { value: "DR", label: "DR" },
];

// The template of the chosen register. Standard when nothing is chosen yet, so
// the form shows the original fields until a register picks otherwise.
export function templateOf(team: Pick<RiskTeam, "register_template"> | null | undefined): RegisterTemplate {
  return team?.register_template ?? "STANDARD";
}

// Security Compliance Reference is the one original field a template drops:
// Managed Services risks are not tracked against compliance frameworks.
export const hasComplianceReferences = (template: RegisterTemplate): boolean => template !== "MANAGED_SERVICES";

export type TemplateField = "platforms" | "customer" | "deploymentType" | "products" | "environments";

// What is missing for the register's template, as field → message. Every field
// the template carries is required; an empty result means the step may proceed.
// The server checks the same rules, so this only spares a round trip.
export function missingTemplateFields(
  template: RegisterTemplate,
  values: Pick<AddRiskFormValues, TemplateField>,
  // The platforms the register offers, to require a sub-platform where it
  // lists some. Left out, only "at least one platform" is checked.
  platforms?: PlatformChoices,
): Partial<Record<TemplateField, string>> {
  const missing: Partial<Record<TemplateField, string>> = {};
  if (template === "AGGREGATED" && values.platforms.length === 0) {
    missing.platforms = "Select at least one platform";
  } else if (template === "AGGREGATED" && platforms) {
    const needsSub = platformMissingSub(platforms, values.platforms);
    if (needsSub) missing.platforms = `Select at least one ${needsSub.name} sub-platform`;
  }
  if (template === "MANAGED_SERVICES") {
    if (values.customer === "") missing.customer = "Customer is required";
    if (values.deploymentType === "") missing.deploymentType = "Deployment type is required";
    if (values.products.length === 0) missing.products = "Select at least one product";
    if (values.environments.length === 0) missing.environments = "Select at least one environment";
  }
  return missing;
}

// The template fields to reset when the source register changes: the previous
// register's fields must not travel into a risk on a register that lacks them,
// and a Managed Services risk has no compliance references. Compliance
// references are only cleared when the new template drops them — switching
// between two registers that both keep them should not lose the user's picks.
export function resetForRegisterChange(newTemplate: RegisterTemplate): Partial<AddRiskFormValues> {
  return {
    platforms: [],
    customer: "",
    deploymentType: "",
    products: [],
    environments: [],
    ...(hasComplianceReferences(newTemplate) ? {} : { complianceReferences: [] }),
  };
}

// The risk-code preview. Managed Services registers put the customer's code in
// the middle, and count per customer (§12). Placeholders stand in for whatever
// is not known yet, so the shape of the final code is visible from the start.
export function riskCodePreview(args: {
  year: number | "";
  quarter: string;
  teamCode: string | null;
  template: RegisterTemplate;
  customerCode: string | null;
  sequenceId: number | null;
}): string {
  const { year, quarter, teamCode, template, customerCode, sequenceId } = args;
  const seq = sequenceId !== null ? String(sequenceId).padStart(4, "0") : "####";
  if (!year || !quarter || !teamCode) {
    return template === "MANAGED_SERVICES" ? "YEAR-REGISTER-CUSTOMER-QUARTER-####" : "YEAR-REGISTER-QUARTER-####";
  }
  if (template === "MANAGED_SERVICES") {
    return `${year}-${teamCode}-${customerCode ?? "CUSTOMER"}-${quarter}-${seq}`;
  }
  return `${year}-${teamCode}-${quarter}-${seq}`;
}

// Options for editing a risk's lookup field. Active values are offered; a value
// the risk already carries stays even once deactivated, marked "(inactive)", so
// editing something else never forces anyone to change historical data. An
// inactive value the risk does not have is not offered: nothing new may be
// added from an inactive value.
export function optionsForEdit(all: LookupOption[], currentIds: number[]): { value: number; label: string }[] {
  return all
    .filter((o) => o.status === "ACTIVE" || currentIds.includes(o.id))
    .map((o) => ({ value: o.id, label: o.status === "ACTIVE" ? o.name : `${o.name} (inactive)` }));
}

// Whether two id lists hold the same values, regardless of order.
export function sameValues<T extends string | number>(a: T[], b: T[]): boolean {
  return a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

// The template whose extra columns the Risk Registers table should show: the
// one every register in the Register filter shares, if it is not Standard.
// With no register selected, or registers on different templates, there is
// nothing sensible to put in a Customer or Platform column, so none is shown
// and the table looks as it always did.
export function templateInView(
  selectedRegisterIds: number[],
  registers: Pick<RiskTeam, "id" | "register_template">[],
): Exclude<RegisterTemplate, "STANDARD"> | null {
  const templates = new Set(
    selectedRegisterIds.map((id) => registers.find((r) => r.id === id)?.register_template ?? "STANDARD"),
  );
  if (templates.size !== 1) return null;
  const [only] = [...templates];
  return only === "STANDARD" ? null : only;
}

// ── Platforms and sub-platforms (Aggregated registers) ───────────────────────
// A sub-platform (Ballerina) is a platform row with a parent (Integration
// Platform). A risk carries both: the platform, and the sub-platforms picked
// under it. A register may list which of them it offers; an empty list offers
// every active one, as every register did before the list existed.

export interface PlatformChoices {
  // Top-level platforms the picker offers.
  platforms: LookupOption[];
  // Sub-platforms the picker offers, by the platform they sit under.
  subsByParent: Map<number, LookupOption[]>;
  // True when the register lists its platforms. The server then requires a
  // sub-platform whenever the register offers any under a chosen platform.
  restricted: boolean;
}

// What the platform picker offers for a register. `all` is every platform and
// sub-platform; `offeredIds` is the register's list. `keepIds` are values the
// risk already carries (the edit form): they stay offered even if inactive or
// since removed from the register, so editing something else never forces a
// change to historical data. Nothing else inactive is offered.
export function platformChoices(all: LookupOption[], offeredIds: number[], keepIds: number[] = []): PlatformChoices {
  const restricted = offeredIds.length > 0;
  const offered = (o: LookupOption): boolean =>
    keepIds.includes(o.id) || (o.status === "ACTIVE" && (!restricted || offeredIds.includes(o.id)));
  const subsByParent = new Map<number, LookupOption[]>();
  for (const o of all) {
    if (o.parent_id === undefined || o.parent_id === null || !offered(o)) continue;
    subsByParent.set(o.parent_id, [...(subsByParent.get(o.parent_id) ?? []), o]);
  }
  return {
    platforms: all.filter((o) => (o.parent_id === undefined || o.parent_id === null) && offered(o)),
    subsByParent,
    restricted,
  };
}

// The first platform the user picked whose offered sub-platforms none of the
// picks include, or null. Only a restricted register requires one: it lists
// sub-platforms on purpose. The server checks the same rule.
export function platformMissingSub(choices: PlatformChoices, selected: number[]): LookupOption | null {
  if (!choices.restricted) return null;
  return (
    choices.platforms.find((p) => {
      const subs = choices.subsByParent.get(p.id) ?? [];
      return selected.includes(p.id) && subs.length > 0 && !subs.some((s) => selected.includes(s.id));
    }) ?? null
  );
}
