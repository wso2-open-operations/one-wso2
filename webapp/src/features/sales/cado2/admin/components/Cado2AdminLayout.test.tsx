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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { ADMIN_SECTION_GROUPS, ADMIN_SECTIONS, FIRST_ADMIN_SECTION } from "../adminSections";
import Cado2AdminLayout from "./Cado2AdminLayout";

const wide = { value: true };
vi.mock("@wso2/oxygen-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wso2/oxygen-ui")>()),
  useMediaQuery: () => wide.value,
}));

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function open(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      <Routes>
        <Route path="sales/cado2/admin" element={<Cado2AdminLayout />}>
          {ADMIN_SECTIONS.map((s) => (
            <Route key={s.id} path={s.id} element={<p>{s.label} content</p>} />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("CadO2 Admin's section list", () => {
  it("lists every section under its group, and marks the open one", () => {
    wide.value = true;
    open("/sales/cado2/admin/currencies");
    const nav = screen.getByRole("navigation", { name: "QuickQuote Admin sections" });
    for (const group of ADMIN_SECTION_GROUPS) expect(within(nav).getByText(group.label)).toBeInTheDocument();
    expect(within(nav).getAllByRole("link")).toHaveLength(ADMIN_SECTIONS.length);
    expect(within(nav).getByRole("link", { name: "Currencies" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Currencies content")).toBeInTheDocument();
  });

  it("gives each section its own address", () => {
    wide.value = true;
    open("/sales/cado2/admin/currencies");
    expect(screen.getByRole("link", { name: "Legal Entities" })).toHaveAttribute(
      "href",
      "/sales/cado2/admin/legal-entities",
    );
  });

  it("becomes a select above the content on a narrow screen", async () => {
    wide.value = false;
    open("/sales/cado2/admin/approval-matrix");
    expect(screen.queryByRole("navigation", { name: "QuickQuote Admin sections" })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Admin section" }));
    await user.click(screen.getByRole("option", { name: "Product Categories" }));
    expect(screen.getByTestId("where").textContent).toBe("/sales/cado2/admin/product-categories");
  });

  it("opens on the approval matrix", () => {
    expect(FIRST_ADMIN_SECTION).toBe("approval-matrix");
  });

  // 2026-10-30: grouped by what the Admin changes, in the quote's order.
  it("groups the sections by what they change", () => {
    expect(ADMIN_SECTION_GROUPS.map((g) => [g.label, g.sections.map((s) => s.label)])).toEqual([
      ["Products & Pricing", ["Product Categories", "Product Bundles", "Pricing Formulas", "Currencies"]],
      ["Approvals", ["Approval Matrix", "Approval SLAs"]],
      ["Order Form", ["Legal Entities", "Legal Texts", "Supporting Documents"]],
      ["Settings", ["Quote Access", "Salesforce Sync", "Email Notifications"]],
    ]);
  });
});
