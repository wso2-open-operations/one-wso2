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

// CadO2 Admin's sections, grouped as the section list shows them. A new
// section is one entry here plus its route in routes.tsx.

import type { Cado2AdminSection } from "@features/sales/cado2/cado2Paths";

export interface AdminSection {
  id: Cado2AdminSection;
  label: string;
}

export interface AdminSectionGroup {
  label: string;
  sections: readonly AdminSection[];
}

// Grouped by what the Admin changes, in the order a quote goes through
// (2026-10-30): build it, approve it, send it; then how the tool behaves.
export const ADMIN_SECTION_GROUPS: readonly AdminSectionGroup[] = [
  {
    // What can be sold, and at what price.
    label: "Products & Pricing",
    sections: [
      { id: "product-categories", label: "Product Categories" },
      { id: "product-bundles", label: "Product Bundles" },
      { id: "pricing-formulas", label: "Pricing Formulas" },
      { id: "currencies", label: "Currencies" },
    ],
  },
  {
    // Who must approve, and how fast.
    label: "Approvals",
    sections: [
      { id: "approval-matrix", label: "Approval Matrix" },
      { id: "approval-slas", label: "Approval SLAs" },
    ],
  },
  {
    // What the customer receives.
    label: "Order Form",
    sections: [
      { id: "legal-entities", label: "Legal Entities" },
      { id: "legal-texts", label: "Legal Texts" },
      { id: "supporting-documents", label: "Supporting Documents" },
    ],
  },
  {
    // How the tool behaves: who may change others' quotes, and whether it
    // writes to Salesforce or sends emails.
    label: "Settings",
    sections: [
      { id: "quote-access", label: "Quote Access" },
      { id: "salesforce-sync", label: "Salesforce Sync" },
      { id: "email-notifications", label: "Email Notifications" },
    ],
  },
];

export const ADMIN_SECTIONS: readonly AdminSection[] = ADMIN_SECTION_GROUPS.flatMap((g) => g.sections);

/** The section Admin opens on: the one used most, whatever its place in the list. */
export const FIRST_ADMIN_SECTION: Cado2AdminSection = "approval-matrix";
