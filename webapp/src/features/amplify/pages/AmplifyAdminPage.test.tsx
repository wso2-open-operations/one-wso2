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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { PointRule } from "../api/amplifyTypes";

const h = vi.hoisted(() => ({
  grants: ["CAN_POINT_RULES"] as string[],
  rules: {
    data: undefined as unknown[] | undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    error: null as unknown,
    refetch: () => undefined,
  },
  mutate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("../api/useAmplifyData", () => ({
  isAmplifyBackendConfigured: () => true,
  usePointRules: () => h.rules,
}));
vi.mock("../api/useAmplifyEditorAccess", () => ({
  useAmplifyAnyGrant: (grants: string[]) => ({
    hasAccess: grants.some((g) => h.grants.includes(g)),
    isResolving: false,
    retry: () => undefined,
  }),
}));
vi.mock("../components/AdminSettingsSections", () => ({
  CoinsSection: () => <section aria-label="Coins" />,
  OwnPostsSection: () => <section aria-label="Own posts" />,
}));
vi.mock("../api/useAmplifyMutations", () => ({ useSetPointRule: () => ({ mutate: h.mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: h.showSuccess, showError: h.showError }),
}));
vi.mock("../components/AmplifyShell", () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  AmplifyPanel: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

import AmplifyAdminPage, { NEW_ACTIVITY_ONLY_NOTE } from "./AmplifyAdminPage";

const rule = (action: PointRule["action"], points: number, inForce = true): PointRule => ({
  id: `${action}-${points}`,
  action,
  points,
  effectiveFrom: "2026-10-01T00:00:00Z",
  createdBy: "po-1",
  createdAt: "2026-10-01T00:00:00Z",
  inForce,
});

beforeEach(() => {
  h.grants = ["CAN_POINT_RULES"];
  h.rules = {
    data: [
      rule("OWN_POST_AMPLIFIED", 25),
      rule("COMMENT", 2),
      rule("REPOST", 4, false),
      rule("REPOST", 5),
      rule("OWN_POST", 10),
      rule("REACTION", 1),
      rule("REPOST_COMMENTARY", 8),
    ],
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: () => undefined,
  };
  h.mutate.mockReset();
  h.showSuccess.mockClear();
});

const table = () => screen.getByRole("table", { name: "Point values" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1) as HTMLTableRowElement[];

describe("AmplifyAdminPage", () => {
  it("is titled Amplify Admin", () => {
    render(<AmplifyAdminPage />);
    expect(screen.getByRole("heading", { name: "Amplify Admin" })).toBeTruthy();
  });

  it("lists the value in force for each action, in plain words", () => {
    render(<AmplifyAdminPage />);
    const rows = bodyRows();
    expect(rows.map((r) => r.cells[0].textContent)).toEqual([
      "Repost",
      "Repost with your thoughts",
      "Reaction on LinkedIn",
      "Comment on LinkedIn",
      "Own post approved",
      "Own post featured (total)The total for a featured post, approval points included.",
    ]);
    expect(rows.map((r) => r.cells[1].textContent)).toEqual(["5", "8", "1", "2", "10", "25"]);
    expect(screen.getByText(NEW_ACTIVITY_ONLY_NOTE)).toBeTruthy();
  });

  it("saves a new value for one action", () => {
    h.mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<AmplifyAdminPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Repost" }));
    const field = screen.getByLabelText("Points for Repost");
    const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.change(field, { target: { value: "6" } });
    fireEvent.click(save());
    expect(h.mutate.mock.calls[0][0]).toEqual({ action: "REPOST", points: 6 });
    expect(h.showSuccess).toHaveBeenCalledWith("Repost: 6 points for new activity.");
    expect(screen.queryByLabelText("Points for Repost")).toBeNull();
  });

  it("refuses a value outside 0 to 10,000", () => {
    render(<AmplifyAdminPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Comment on LinkedIn" }));
    for (const value of ["-1", "10001", "2.5", ""]) {
      fireEvent.change(screen.getByLabelText("Points for Comment on LinkedIn"), { target: { value } });
      expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("edits one row at a time, and Cancel leaves the value alone", () => {
    render(<AmplifyAdminPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Repost" }));
    expect((screen.getByRole("button", { name: "Edit Reaction on LinkedIn" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Points for Repost")).toBeNull();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("shows the point values only to CAN_POINT_RULES", () => {
    h.grants = ["CAN_ADMIN", "CAN_DASHBOARD"];
    render(<AmplifyAdminPage />);
    expect(screen.queryByRole("region", { name: "Point values" })).toBeNull();
  });

  const regions = () => screen.queryAllByRole("region").map((r) => r.getAttribute("aria-label"));

  it("shows the PO team Point values, Coins and Own posts, in that order", () => {
    h.grants = ["CAN_POINT_RULES"];
    render(<AmplifyAdminPage />);
    expect(regions()).toEqual(["Point values", "Coins", "Own posts"]);
  });

  it("shows an admin without CAN_POINT_RULES Coins and Own posts only", () => {
    h.grants = ["CAN_ADMIN"];
    render(<AmplifyAdminPage />);
    expect(regions()).toEqual(["Coins", "Own posts"]);
  });

  it("shows nothing to a caller with neither grant", () => {
    h.grants = ["CAN_DASHBOARD", "CAN_REVIEW_SHARES", "CAN_ADJUST_POINTS"];
    render(<AmplifyAdminPage />);
    expect(regions()).toEqual([]);
  });

  it("offers a retry when the rules fail to load", () => {
    h.rules = { ...h.rules, data: undefined, isError: true, error: new Error("down") };
    render(<AmplifyAdminPage />);
    expect(screen.getByText(/Couldn't load the point values/)).toBeTruthy();
  });
});
