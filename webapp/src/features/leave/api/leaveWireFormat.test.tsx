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
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { LeavePayload } from "./leaveTypes";

// jsdom's Blob has no .text().
const readBlobText = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(b);
  });

// Four of the five defects the audit found are payload defects: a query param
// that is not sent, a filter that is not applied, a recipient list that goes out
// empty. None of them would show in a unit test of the helper that builds the
// request — they only show on the wire. So these assert the URL and the body.

const requests: { method: string; url: string; body?: unknown }[] = [];
vi.mock("@api/http", () => ({
  authedGet: (url: string) => {
    requests.push({ method: "GET", url });
    return Promise.resolve([]);
  },
  authedPost: (url: string, _token: string, body: unknown) => {
    requests.push({ method: "POST", url, body });
    return Promise.resolve({});
  },
  authedUpload: (url: string, _token: string, formData: FormData) => {
    requests.push({ method: "UPLOAD", url, body: formData });
    return Promise.resolve({ message: "ok" });
  },
  authedDelete: (url: string) => {
    requests.push({ method: "DELETE", url });
    return Promise.resolve(undefined);
  },
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (q: unknown) => q,
}));
vi.mock("@config/apiConfig", () => ({
  isLeaveBackendConfigured: () => true,
  leaveServiceUrls: {
    employees: "https://leave.test/employees",
    leaves: "https://leave.test/leaves",
    leave: (id: number) => `https://leave.test/leaves/${id}`,
    sickLeave: "https://leave.test/leaves/sick-leave",
    sickNotes: (s: string, e: string) => `https://leave.test/sick-notes?startDate=${s}&endDate=${e}`,
    leaveAction: (id: number, a: string) => `https://leave.test/leaves/${id}/${a}`,
    userInfo: "https://leave.test/user-info",
    appConfigs: "https://leave.test/app-configs",
    leaveEntitlement: (e: string, years?: number[]) => {
      const base = `https://leave.test/employees/${e}/leave-entitlement`;
      if (!years || years.length === 0) return base;
      return `${base}?${years.map((y) => `years=${y}`).join("&")}`;
    },
  },
}));

const { useLeaveEmployees, useLeaveEntitlement, useLeaves, useSickNotes } = await import("./useLeaveData");
const { useSubmitLeave, useCancelLeave, useSubmitSickLeave, useApproveLeave } = await import("./useLeaveMutations");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  requests.length = 0;
});

// L4. The backend hands `status: ()` straight to the HR GraphQL filter when the
// param is absent, so the picker is populated from whatever that defaults to
// rather than the three the source names.
describe("the employee list", () => {
  it("asks for the three statuses the source asks for", async () => {
    renderHook(() => useLeaveEmployees(), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));

    const url = new URL(requests[0].url);
    expect(url.pathname).toBe("/employees");
    expect(url.searchParams.getAll("employeeStatuses")).toEqual([
      "Active",
      "Marked leaver",
      "Left",
    ]);
  });
});

// L1. Not a display filter — it changes which rows the backend returns. With it
// present the backend resolves the employee set by leadEmail and clears
// approverEmail; without it, it filters on the stored approverEmail.
describe("the report filter", () => {
  it("carries employeeStatuses on the wire", async () => {
    renderHook(
      () =>
        useLeaves({
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          statuses: ["APPROVED"],
          approverEmail: "lead@wso2.com",
          employeeStatuses: ["Active", "Marked leaver"],
        }),
      { wrapper },
    );
    await waitFor(() => expect(requests).toHaveLength(1));

    const url = new URL(requests[0].url);
    expect(url.searchParams.getAll("employeeStatuses")).toEqual(["Active", "Marked leaver"]);
    expect(url.searchParams.get("approverEmail")).toBe("lead@wso2.com");
  });

  // The exact request a lead's report makes, compared against one confirmed
  // working against the live backend on 2026-09-01:
  //
  //   /leaves?approverEmail=approver%40example.com&startDate=2026-01-01
  //          &endDate=2026-09-01&statuses=APPROVED
  //          &employeeStatuses=Active&employeeStatuses=Marked%20leaver
  //
  // The same request with `limit=1000&orderBy=DESC` added and employeeStatuses
  // dropped came back empty. The running app sends neither — it never puts a
  // `limit` on an approver-scoped query at all (leaveService.ts:145-150 builds
  // them, LeadReportTab.tsx:55-62 sends none) — so this asserts the absence as
  // firmly as the presence.
  it("sends the parameter set the live backend answers, and nothing else", async () => {
    renderHook(
      () =>
        useLeaves({
          startDate: "2026-01-01",
          endDate: "2026-09-01",
          statuses: ["APPROVED"],
          approverEmail: "approver@example.com",
          employeeStatuses: ["Active", "Marked leaver"],
        }),
      { wrapper },
    );
    await waitFor(() => expect(requests).toHaveLength(1));

    const sent = new URL(requests[0].url).searchParams;
    const working = new URL(
      "https://x/leaves?approverEmail=approver%40example.com&startDate=2026-01-01" +
        "&endDate=2026-09-01&statuses=APPROVED" +
        "&employeeStatuses=Active&employeeStatuses=Marked%20leaver",
    ).searchParams;

    const pairs = (p: URLSearchParams) =>
      [...p.entries()].map(([k, v]) => `${k}=${v}`).sort();
    expect(pairs(sent)).toEqual(pairs(working));
  });

  it("puts no limit on an approver-scoped report", async () => {
    renderHook(
      () =>
        useLeaves({
          startDate: "2026-01-01",
          endDate: "2026-09-01",
          statuses: ["APPROVED"],
          approverEmail: "lead@wso2.com",
          employeeStatuses: ["Active"],
        }),
      { wrapper },
    );
    await waitFor(() => expect(requests).toHaveLength(1));
    const sent = new URL(requests[0].url).searchParams;
    expect(sent.get("limit")).toBeNull();
    expect(sent.get("orderBy")).toBeNull();
  });

  it("encodes an email rather than interpolating it raw", async () => {
    // The source builds this one param with a bare template literal
    // (leaveService.ts:122) while encoding every sibling.
    renderHook(() => useLeaves({ email: "a+b@wso2.com", statuses: ["APPROVED"] }), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].url).toContain("email=a%2Bb%40wso2.com");
  });
});

describe("submitting a leave", () => {
  it("posts the recipients it was given", async () => {
    const { result } = renderHook(() => useSubmitLeave(), { wrapper });
    result.current.mutate({
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      periodType: "one",
      isMorningLeave: null,
      leaveType: "casual",
      comment: "",
      emailRecipients: ["colleague@wso2.com"],
      isPublicComment: false,
    });
    await waitFor(() => expect(requests).toHaveLength(1));

    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toContain("isValidationOnlyMode=false");
    expect(requests[0].body).toMatchObject({
      leaveType: "casual",
      emailRecipients: ["colleague@wso2.com"],
    });
  });
});

// L2. Submitting spends entitlement, and ["leave-entitlement"] carries a
// five-minute staleTime — so invalidating only ["leaves"] left the balance
// panel showing pre-submit figures for that long.
describe("what a submit invalidates", () => {
  it("invalidates the balance as well as the list", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidated: unknown[] = [];
    const spy = vi.spyOn(client, "invalidateQueries").mockImplementation((arg) => {
      invalidated.push((arg as { queryKey?: unknown })?.queryKey);
      return Promise.resolve();
    });

    const { result } = renderHook(() => useSubmitLeave(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      periodType: "one",
      isMorningLeave: null,
      leaveType: "casual",
      comment: "",
      emailRecipients: [],
      isPublicComment: false,
    });

    await waitFor(() => expect(invalidated.length).toBeGreaterThanOrEqual(3));
    expect(invalidated).toContainEqual(["leaves"]);
    expect(invalidated).toContainEqual(["leave-entitlement"]);
    // THE one that was missing. optionalMails IS the copyEmailList of the
    // caller's most recent request (backend/utils.bal:648-691), so the submit
    // just changed it — and ["leave-app-config"] carries a THIRTY-minute
    // staleTime. Without this, editing who to notify, submitting, and coming
    // back to the form showed the people from the request before.
    expect(invalidated).toContainEqual(["leave-app-config"]);
    spy.mockRestore();
  });
});

describe("cancelling", () => {
  it("deletes by id, with no body", async () => {
    const { result } = renderHook(() => useCancelLeave(), { wrapper });
    result.current.mutate(42);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ method: "DELETE", url: "https://leave.test/leaves/42" });
  });
});

// The congés-payés leave year is not the calendar year, so the default
// entitlement record covers a different window than RTT is reported over.
// LeaveBalanceSummary.tsx:94-100 issues a second, calendar-year request for
// exactly that reason and reads the RTT row from it (:145). The port had
// dropped the second call and read RTT from the congés-payés record.
describe("the leave entitlement request", () => {
  it("asks for no particular year by default, letting the backend pick the period", async () => {
    renderHook(() => useLeaveEntitlement("someone@wso2.com"), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].url).not.toContain("years=");
  });

  it("asks for the calendar year when one is named", async () => {
    renderHook(() => useLeaveEntitlement("someone@wso2.com", true, [2026]), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].url).toContain("years=2026");
  });

  it("caches the two separately, so one cannot serve the other", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const shared = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(() => useLeaveEntitlement("someone@wso2.com"), { wrapper: shared });
    renderHook(() => useLeaveEntitlement("someone@wso2.com", true, [2026]), { wrapper: shared });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests.filter((r) => r.url.includes("years=2026"))).toHaveLength(1);
    expect(requests.filter((r) => !r.url.includes("years="))).toHaveLength(1);
  });
});

describe("a sick-leave submit", () => {
  it("sends exactly a `leave` JSON part and a `sickNote` file part", async () => {
    const payload: LeavePayload = {
      startDate: "2026-03-02",
      endDate: "2026-03-03",
      periodType: "multiple",
      isMorningLeave: null,
      leaveType: "sick",
      comment: "",
      emailRecipients: [],
      isPublicComment: false,
    };
    const file = new File(["%PDF-1.4"], "note.pdf", { type: "application/pdf" });
    const { result } = renderHook(() => useSubmitSickLeave(), { wrapper });
    result.current.mutate({ payload, sickNote: file });
    await waitFor(() => expect(requests).toHaveLength(1));

    expect(requests[0].method).toBe("UPLOAD");
    expect(requests[0].url).toBe("https://leave.test/leaves/sick-leave");
    const form = requests[0].body as FormData;
    expect([...form.keys()].sort()).toEqual(["leave", "sickNote"]);
    const leave = form.get("leave") as Blob;
    expect(leave.type).toBe("application/json");
    expect(JSON.parse(await readBlobText(leave))).toEqual(payload);
    expect((form.get("sickNote") as File).name).toBe("note.pdf");
  });

  it("invalidates the same three caches as a plain submit", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidated: unknown[] = [];
    vi.spyOn(client, "invalidateQueries").mockImplementation((arg) => {
      invalidated.push((arg as { queryKey?: unknown })?.queryKey);
      return Promise.resolve();
    });
    const { result } = renderHook(() => useSubmitSickLeave(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({
      payload: {
        startDate: "2026-03-02",
        endDate: "2026-03-02",
        periodType: "one",
        isMorningLeave: null,
        leaveType: "sick",
        comment: "",
        emailRecipients: [],
        isPublicComment: false,
      },
      sickNote: new File(["x"], "n.png", { type: "image/png" }),
    });
    await waitFor(() => expect(invalidated.length).toBeGreaterThanOrEqual(3));
    expect(invalidated).toContainEqual(["leaves"]);
    expect(invalidated).toContainEqual(["leave-entitlement"]);
    expect(invalidated).toContainEqual(["leave-app-config"]);
  });
});

describe("a lead's decision", () => {
  it("sends a reason only when one is given", async () => {
    const { result } = renderHook(() => useApproveLeave(), { wrapper });

    result.current.mutate({ id: 7, action: "approve" });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].url).toBe("https://leave.test/leaves/7/approve");
    expect(requests[0].body).toEqual({});

    result.current.mutate({ id: 7, action: "reject", reason: "Busy week" });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].url).toBe("https://leave.test/leaves/7/reject");
    expect(requests[1].body).toEqual({ reason: "Busy week" });

    result.current.mutate({ id: 7, action: "reject" });
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2].body).toEqual({});
  });
});

describe("the sick-note list", () => {
  it("asks for the range and is keyed per user", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    renderHook(() => useSickNotes("2026-01-01", "2026-12-31"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].url).toBe("https://leave.test/sick-notes?startDate=2026-01-01&endDate=2026-12-31");
    expect(client.getQueryCache().find({ queryKey: ["leave-sick-notes", "sub-1", "2026-01-01", "2026-12-31"] })).toBeDefined();
  });

  it("does not fire when disabled", async () => {
    renderHook(() => useSickNotes("2026-01-01", "2026-12-31", false), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(requests).toHaveLength(0);
  });
});
