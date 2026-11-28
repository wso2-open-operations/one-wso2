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
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyBudget, emptyDetails, emptyEvent } from "../request-form/requestFormModel";
import type { ProcurementLookups, ProcurementMe, PurchaseRequest } from "../types";
import RequestDetailPage from "./RequestDetailPage";

const query = (data: unknown = undefined) => ({ data, isPending: false, isFetching: false, isError: false, error: null as unknown, refetch: vi.fn() });

// What the queries answer. Changing an answer tells the screens that read it, as a real query does.
const state = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    requests: {} as Record<string, unknown>,
    me: {} as Record<string, unknown>,
    lookups: {} as Record<string, unknown>,
    engagement: {} as Record<string, unknown>,
    attachments: {} as Record<string, unknown>,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    notify: () => listeners.forEach((listener) => listener()),
  };
});

vi.mock("../api/useProcurement", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRequest: (id?: string) => ({ data: state.requests[id ?? ""], isPending: false, isError: false, error: null, refetch: vi.fn() }),
    useProcurementMe: () => useSyncExternalStore(state.subscribe, () => state.me),
    useProcurementLookups: () => useSyncExternalStore(state.subscribe, () => state.lookups),
    useEngagementCodes: () => useSyncExternalStore(state.subscribe, () => state.engagement),
    useBudgetApprovers: () => ({ data: [], isFetching: false, isError: false, error: null }),
    useDirectorySearch: () => ({ data: [], isFetching: false, isError: false, error: null }),
    useResubmitRequest: () => ({ isPending: false, isError: false, error: null, mutate: vi.fn() }),
    useCancelRequest: () => ({ isPending: false, isError: false, error: null, mutate: vi.fn() }),
    useAttachments: () => useSyncExternalStore(state.subscribe, () => state.attachments),
    useDownloadAttachment: () => ({ isPending: false, isError: false, error: null, mutate: vi.fn(), variables: undefined }),
  };
});
const person = { id: "lead@example.com", name: "Team Lead", email: "lead@example.com" };
const me: ProcurementMe = { id: "me@example.com", name: "Me Myself", email: "me@example.com", roles: [], teamLead: person, approvalExempt: false };
const lookups: ProcurementLookups = { budgetCategories: [], businessUnits: [], products: [], regions: [] };

const request = (id: string, patch: Partial<PurchaseRequest> = {}): PurchaseRequest => ({
  id,
  reference: `PR-2026-0000${id}`,
  title: `Request ${id}`,
  category: "IT",
  status: "rejected",
  submittedAt: "2026-11-02T08:00:00.000Z",
  updatedAt: "2026-11-02T08:00:00.000Z",
  requester: me,
  teamLead: person,
  additionalApprovers: [],
  teamLeadDecision: { decision: "rejected", notes: "Get a second quote.", decidedAt: "2026-11-03T08:00:00.000Z", decidedBy: "lead@example.com", isOverride: false },
  details: emptyDetails(),
  event: emptyEvent(),
  vendors: [],
  budget: emptyBudget(),
  budgetApproverId: "",
  budgetApproverName: "",
  notes: "",
  priority: null,
  assignee: "",
  collaborators: [],
  ...patch,
});

const tree = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <Link to="/me/procurement/requests/2">Open the other request</Link>
    <Routes>
      <Route path="/me/procurement/requests/:requestId" element={<RequestDetailPage />} />
    </Routes>
  </MemoryRouter>
);

function renderAt(path: string) {
  return render(tree(path));
}

beforeEach(() => {
  state.requests = { "1": request("1"), "2": request("2") };
  state.me = query(me);
  state.lookups = query(lookups);
  state.engagement = query([]);
  state.attachments = query([]);
});

describe("RequestDetailPage", () => {
  it("offers to cancel a submitted or rejected request, and no other", () => {
    for (const [status, offered] of [["submitted", true], ["rejected", true], ["approved", false], ["cancelled", false]] as const) {
      state.requests = { "1": request("1", { status }) };
      const { unmount } = renderAt("/me/procurement/requests/1");
      expect(screen.queryByRole("button", { name: "Cancel request" }) !== null).toBe(offered);
      unmount();
    }
  });

  it("offers Cancel and Edit only to the requester, and hides them when who you are is not known", () => {
    const other = { ...me, id: "other@example.com", email: "Other@example.com" };
    state.me = query(other);
    const { unmount } = renderAt("/me/procurement/requests/1");
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit and resubmit" })).toBeNull();
    unmount();
    state.me = { ...query(), isError: true, error: new Error("Employee not found."), refetch: vi.fn() };
    renderAt("/me/procurement/requests/1");
    expect(screen.queryByRole("button", { name: "Cancel request" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit and resubmit" })).toBeNull();
  });

  it("says who made the decision, and when it was a Procurement review", () => {
    state.requests = {
      "1": request("1", { teamLeadDecision: { decision: "rejected", notes: "Over budget.", decidedAt: "2026-11-04T08:00:00.000Z", decidedBy: "admin@example.com", isOverride: true } }),
    };
    renderAt("/me/procurement/requests/1");
    expect(screen.getByText(/Rejected by admin@example.com \(Procurement review\)/)).toBeInTheDocument();
  });

  it("shows the editor's failed dependency with a Retry, instead of loading for ever", async () => {
    const failing = { ...query(), isError: true, error: new Error("Employee not found."), refetch: vi.fn() };
    const user = userEvent.setup();
    renderAt("/me/procurement/requests/1");
    await user.click(screen.getByRole("button", { name: "Edit and resubmit" }));
    act(() => {
      state.me = failing;
      state.notify();
    });
    expect(screen.getByText("Employee not found.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(failing.refetch).toHaveBeenCalledOnce();
  });

  it("keeps the edit form, and what has been done in it, when a later refresh fails, and offers a Retry beside it", async () => {
    const user = userEvent.setup();
    const path = "/me/procurement/requests/1";
    renderAt(path);
    await user.click(screen.getByRole("button", { name: "Edit and resubmit" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /^Non-IT Related Procurement/ }));
    expect(screen.getByRole("radio", { name: /^Non-IT Related Procurement/ })).toBeChecked();

    // A refresh fails, but the answer it held is still there.
    const refetch = vi.fn();
    act(() => {
      state.me = { ...query(me), isError: true, error: new Error("Network down."), refetch };
      state.notify();
    });

    expect(screen.getByText("Network down.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Procurement category" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Non-IT Related Procurement/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();

    // And once it recovers, the form is still the same one.
    act(() => {
      state.me = query(me);
      state.notify();
    });
    expect(screen.queryByText("Network down.")).toBeNull();
    expect(screen.getByRole("radio", { name: /^Non-IT Related Procurement/ })).toBeChecked();
  });

  it("keeps the edit form and offers a Retry when refreshing the attachments fails after they were loaded", async () => {
    const user = userEvent.setup();
    renderAt("/me/procurement/requests/1");
    await user.click(screen.getByRole("button", { name: "Edit and resubmit" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /^Non-IT Related Procurement/ }));

    const refetch = vi.fn();
    act(() => {
      state.attachments = { ...query([]), isError: true, error: new Error("Files unavailable."), refetch };
      state.notify();
    });

    expect(screen.getByText("Files unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Non-IT Related Procurement/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("warns that budget names did not load, keeps the codes, and retries only what failed", async () => {
    const failing = { ...query(), isError: true, error: new Error("Lists unavailable."), refetch: vi.fn() };
    state.lookups = failing;
    state.engagement = query([]);
    const user = userEvent.setup();
    renderAt("/me/procurement/requests/1");
    expect(screen.getByText(/Some names could not be loaded, so budget values show as codes/)).toBeInTheDocument();
    expect(screen.getByText(/Lists unavailable\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(failing.refetch).toHaveBeenCalledOnce();
  });

  it("does not warn when the names loaded", () => {
    renderAt("/me/procurement/requests/1");
    expect(screen.queryByText(/Some names could not be loaded/)).toBeNull();
  });

  it("starts the editor over when another request is opened, so one request's draft is never sent to the other", async () => {
    const user = userEvent.setup();
    renderAt("/me/procurement/requests/1");
    await user.click(screen.getByRole("button", { name: "Edit and resubmit" }));
    expect(screen.getByRole("button", { name: "Cancel editing" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Open the other request" }));
    expect(screen.getByRole("heading", { name: /Request 2/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel editing" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit and resubmit" })).toBeInTheDocument();
  });

  it("offers the requester a pencil to change the team lead only while the request waits for its first decision", () => {
    const waiting = { decision: "pending" as const, notes: "", decidedAt: null, decidedBy: "", isOverride: false };
    state.requests = { "3": request("3", { status: "submitted", teamLeadDecision: waiting }), "4": request("4") };
    const first = renderAt("/me/procurement/requests/3");
    expect(screen.getByRole("button", { name: "Change team lead" })).toBeInTheDocument();
    first.unmount();
    renderAt("/me/procurement/requests/4");
    expect(screen.queryByRole("button", { name: "Change team lead" })).toBeNull();
  });

  it("says when who the viewer is could not be read, keeps the summary, and retries", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    state.me = { data: undefined, isPending: false, isFetching: false, isError: true, error: new Error("Could not reach the server."), refetch };
    renderAt("/me/procurement/requests/1");
    expect(screen.getByText(/Who you are could not be read/)).toBeInTheDocument();
    expect(screen.getByText("Request 1", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
