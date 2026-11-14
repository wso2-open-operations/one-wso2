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
import LegalTextsPage from "./LegalTextsPage";
import { textHint } from "./textHint";

const change = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown };
const admin = {
  error: null,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
  data: {
    texts: [{ key: "TERMS_ONPREM_DIRECT", body: '<p>Governed by <a href="https://wso2.com/licenses/eula/3.6">WSO2 Software License</a>.</p>', updatedByEmail: "seed", updatedAt: "2026-10-24T10:00:00Z" }],
    notices: [
      { id: 4, title: "Middle East and Africa – for new Subscribers", body: "Report usage quarterly.", showTitle: true, finePrint: false,
        channels: ["PARTNER"], regions: ["ME", "AFRICA"], dealKinds: ["FIRST_SALE"], updatedByEmail: "seed", updatedAt: "2026-10-24T10:00:00Z" },
    ],
    placeholders: ["{CONTRACT_NAME}", "{PARTNER_NAME}", "{CONTRACT_DATE}"],
  },
};
const changes = { data: [] as unknown[], error: null as unknown, isFetching: false, refetch: vi.fn() };
vi.mock("@features/sales/cado2/admin/components/useAdminChanges", () => ({
  useAdminChanges: () => changes,
}));
vi.mock("@features/sales/cado2/admin/legal-texts/api/useLegalAdmin", () => ({
  useLegalAdmin: () => admin,
  useLegalAdminChange: () => change,
}));

// Legal terms (2026-10-24).
describe("LegalTextsPage", () => {
  it("lists the standard texts and the notices with when they apply", () => {
    render(<LegalTextsPage />);
    // No EULA setting: the link is part of the texts (2026-10-24).
    expect(screen.queryByRole("table", { name: "EULA versions" })).toBeNull();
    const direct = within(screen.getByRole("group", { name: "On-premises products · direct deals" }));
    expect(direct.getByRole("link", { name: "WSO2 Software License" })).toHaveAttribute("href", "https://wso2.com/licenses/eula/3.6");
    // No placeholder hint on a direct text, and no "seed" as a person.
    expect(screen.queryByText(/filled in from the deal/)).toBeNull();
    expect(screen.queryByText(/seed/)).toBeNull();
    const notices = within(screen.getByRole("table", { name: "Notices" }));
    expect(notices.getByText("Partner")).toBeInTheDocument();
    expect(notices.getByText("ME, AFRICA")).toBeInTheDocument();
    expect(notices.getByText("First sale")).toBeInTheDocument();
    // No partner agreements section: the AM chooses on the quote (2026-10-24).
    expect(screen.queryByRole("table", { name: "Partner agreements" })).toBeNull();
  });

  // A notice is removed only after a confirmation.
  it("asks before removing a notice", async () => {
    change.mutate.mockClear();
    render(<LegalTextsPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Remove Middle East and Africa – for new Subscribers" }));
    const dialog = within(screen.getByRole("dialog", { name: /Remove the notice/ }));
    expect(change.mutate).not.toHaveBeenCalled();
    await user.click(dialog.getByRole("button", { name: "Remove notice" }));

    expect(change.mutate).toHaveBeenCalledWith({ kind: "deleteNotice", id: 4 }, expect.anything());
  });

  it("says which placeholders a partner text may use, and who changed a text", () => {
    const ph = ["{CONTRACT_NAME}", "{PARTNER_NAME}", "{CONTRACT_DATE}"];
    expect(textHint("TERMS_ONPREM_PARTNER", "2026-10-24T10:00:00Z", "seed", ph)).toBe(
      "{CONTRACT_NAME}, {PARTNER_NAME} and {CONTRACT_DATE} are filled in from the deal.",
    );
    expect(textHint("TERMS_ONPREM_DIRECT", "2026-10-24T10:00:00Z", "seed", ph)).toBe("");
    expect(textHint("TERMS_SAAS_DIRECT", "2026-10-24T10:00:00Z", "priya@wso2.com", ph)).toBe("Changed 24 Oct 2026 by priya@wso2.com");
  });

  // D172: every change to a text or notice, with its wording before and after.
  it("lists each change in the Change Log, with the wording before and after", async () => {
    changes.data = [
      {
        id: 7, area: "LEGAL_TEXT", item: "TERMS_ONPREM_DIRECT", action: "CHANGED", changedByEmail: "legal@wso2.com", changedAt: "2026-11-14T09:00:00Z",
        before: { body: "<p>Old terms.</p>" }, after: { body: "<p>New terms.</p>" },
      },
      {
        id: 6, area: "LEGAL_NOTICE", item: "4", action: "DELETED", changedByEmail: "legal@wso2.com", changedAt: "2026-11-13T09:00:00Z",
        before: { title: "Export control", body: "Export rules." }, after: null,
      },
    ];
    render(<LegalTextsPage />);
    const log = within(screen.getByRole("list", { name: "Legal text changes" }));
    expect(log.getByText(/Notice: Export control/)).toBeInTheDocument();
    await userEvent.setup().click(log.getAllByRole("button", { name: "Show before and after" })[0]);
    expect(log.getByText("Old terms.")).toBeInTheDocument();
    expect(log.getByText("New terms.")).toBeInTheDocument();
    changes.data = [];
  });
});
