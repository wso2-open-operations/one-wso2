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

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeadlineDaysDialog from "./DeadlineDaysDialog";
import { AuditPrivilege } from "@features/security/grc/modules/audit/privileges";
import type { DeadlineDaysResponse } from "@features/security/grc/modules/audit/types/audit";

const authFetch = vi.hoisted(() => vi.fn());
const privileges = vi.hoisted(() => ({ held: new Set<string>() }));
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({ useAuthApiClient: () => authFetch }));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));
vi.mock("@features/security/grc/modules/audit/hooks/useAuditPrivileges", () => ({
  useAuditPrivileges: () => ({ can: (p: string) => privileges.held.has(p), loading: false }),
}));

const DAYS: DeadlineDaysResponse = {
  auditId: 7,
  phase: "EVIDENCE",
  days: [
    { cycleType: "INITIAL", handledBy: "OWNER", allowedDays: 30, isDefault: true },
    { cycleType: "INITIAL", handledBy: "COMPLIANCE", allowedDays: 10, isDefault: true },
    { cycleType: "INITIAL", handledBy: "AUDITOR", allowedDays: 10, isDefault: true },
    { cycleType: "REVISION", handledBy: "OWNER", allowedDays: 15, isDefault: false },
    { cycleType: "REVISION", handledBy: "COMPLIANCE", allowedDays: 5, isDefault: true },
    { cycleType: "REVISION", handledBy: "AUDITOR", allowedDays: 5, isDefault: true },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <DeadlineDaysDialog auditId={7} open onClose={onClose} />
    </QueryClientProvider>,
  );
  return { invalidate, onClose };
}

const input = (name: string) => screen.findByRole("textbox", { name });

beforeEach(() => {
  authFetch.mockReset().mockImplementation((_url: string, init?: RequestInit) =>
    Promise.resolve(init?.method === "PUT" ? json(DAYS) : json(DAYS)),
  );
  privileges.held = new Set([AuditPrivilege.ManageControls]);
});

describe("DeadlineDaysDialog", () => {
  it("renders nothing and asks for nothing without the manage-controls privilege", () => {
    privileges.held = new Set();
    renderDialog();
    expect(screen.queryByText("Deadline Days")).not.toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("shows the six numbers, which are defaults, and the hand-off hint", async () => {
    renderDialog();
    expect(await input("Initial days for Owner")).toHaveValue("30");
    expect(await input("Revision days for Auditor")).toHaveValue("5");
    expect(screen.getAllByText("Default")).toHaveLength(5);
    expect(screen.getByText(/only affect hand-offs that happen afterwards/i)).toBeInTheDocument();
  });

  it("rejects values outside 1 to 365 and keeps Save disabled", async () => {
    const user = userEvent.setup();
    renderDialog();
    const field = await input("Initial days for Compliance");
    await user.clear(field);
    await user.type(field, "400");
    expect(screen.getByText(/whole number from 1 to 365/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(field);
    await user.type(field, "1.5");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves only the changed rows, then refreshes the days and the controls list", async () => {
    const user = userEvent.setup();
    const { invalidate, onClose } = renderDialog();
    const field = await input("Initial days for Compliance");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(field);
    await user.type(field, "12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const put = authFetch.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(put?.[0]).toBe("http://backend.test/api/v1/audits/7/settings/deadline-days");
    expect(JSON.parse(put?.[1].body as string)).toEqual({
      days: [{ cycleType: "INITIAL", handledBy: "COMPLIANCE", allowedDays: 12 }],
    });
    const keys = invalidate.mock.calls.map(([f]) => f?.queryKey);
    expect(keys).toContainEqual(["audits", 7, "deadline-days"]);
    expect(keys).toContainEqual(["audits", 7, "controls"]);
  });

  it("shows the server's message when the save fails and stays open", async () => {
    authFetch.mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(init?.method === "PUT" ? json({ message: "allowedDays must be between 1 and 365" }, 400) : json(DAYS)),
    );
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    const field = await input("Initial days for Owner");
    await user.clear(field);
    await user.type(field, "20");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("allowedDays must be between 1 and 365")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
