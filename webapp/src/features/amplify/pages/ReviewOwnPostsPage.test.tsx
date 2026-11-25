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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { HttpError } from "@api/http";
import type { ExternalShare } from "../api/amplifyTypes";

const h = vi.hoisted(() => ({
  list: {
    data: undefined as { items: unknown[]; page: number; size: number; total: number } | undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    error: null as unknown,
    refetch: () => undefined,
  },
  myId: "me-1",
  waiting: undefined as number | undefined,
  values: undefined as Record<string, number> | undefined,
  person: { name: "Jane Doe", photoUrl: null as string | null, team: null, businessUnit: null },
  lookups: [] as unknown[],
  approve: vi.fn(),
  feature: vi.fn(),
  decline: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  listArgs: [] as unknown[][],
}));

vi.mock("../api/useAmplifyData", () => ({
  REVIEW_PAGE_SIZE: 10,
  isAmplifyBackendConfigured: () => true,
  useExternalSharesForReview: (...args: unknown[]) => {
    h.listArgs.push(args);
    return h.list;
  },
  useAmplifyMe: () => ({ data: { employee: { employeeId: h.myId } } }),
  useWaitingReviewCount: () => ({ data: h.waiting }),
  usePointValues: () => ({ data: h.values }),
}));
vi.mock("../api/useAmplifyMutations", () => ({
  useApproveExternalShare: () => ({ mutateAsync: h.approve, isPending: false }),
  useFeatureExternalShare: () => ({ mutateAsync: h.feature, isPending: false }),
  useDeclineExternalShare: () => ({ mutate: h.decline, isPending: false }),
}));
vi.mock("../api/usePersonLookup", () => ({
  UNKNOWN_EMPLOYEE: "Unknown employee",
  usePersonLookup: () => (p: unknown) => {
    h.lookups.push(p);
    return h.person;
  },
}));
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
}));

import ReviewOwnPostsPage, { FEATURE_AFTER_APPROVE_FAILED, OWN_CLAIM_NOTE, ReviewTab } from "./ReviewOwnPostsPage";

const share = (id: string, status: ExternalShare["status"], extra: Partial<ExternalShare> = {}): ExternalShare => ({
  id,
  employeeId: "e-9",
  action: "OWN_POST",
  evidenceUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`,
  evidenceHost: "www.linkedin.com",
  evidenceProvider: "linkedin",
  status,
  createdAt: "2026-11-20T10:00:00Z",
  version: 1,
  ...extra,
});

function showList(items: ExternalShare[], total = items.length) {
  h.list = { ...h.list, data: { items, page: 0, size: 10, total }, isPending: false, isError: false };
}

const problem = (status: number, code: string) =>
  new HttpError("https://api.test/po/external-shares/x/approve", status, JSON.stringify({ status, code }));

beforeEach(() => {
  h.list = { data: undefined, isPending: false, isError: false, isFetching: false, error: null, refetch: () => undefined };
  h.myId = "me-1";
  h.waiting = undefined;
  h.values = undefined;
  h.person = { name: "Jane Doe", photoUrl: null, team: null, businessUnit: null };
  h.lookups.length = 0;
  h.approve.mockReset().mockResolvedValue({});
  h.feature.mockReset().mockResolvedValue({});
  h.decline.mockReset();
  h.showSuccess.mockClear();
  h.showError.mockClear();
  h.listArgs.length = 0;
});

describe("a waiting post", () => {
  it("shows who sent it, their note, when, and the LinkedIn link", () => {
    showList([share("x-1", "PENDING", { note: "Wrote this for the launch." })]);
    render(<ReviewTab status="PENDING" />);
    const card = screen.getByRole("article", { name: "Post from Jane Doe" });
    expect(within(card).getByText("Jane Doe")).toBeTruthy();
    expect(within(card).getByText("Wrote this for the launch.")).toBeTruthy();
    expect(within(card).getByText(/^Submitted /)).toBeTruthy();
    const link = within(card).getByRole("link", { name: /Open on LinkedIn/ });
    expect(link.getAttribute("href")).toBe("https://www.linkedin.com/feed/update/urn:li:activity:x-1/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(h.listArgs[0]).toEqual(["PENDING", 0]);
  });

  it("offers Approve (+10), Feature (+25) and Decline", () => {
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByRole("button", { name: "Approve (+10)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Feature (+25)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
  });

  it("approves by id and says so", async () => {
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve (+10)" }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith("Approved: +10 points for Jane Doe."));
    expect(h.approve).toHaveBeenCalledWith({ id: "x-1", employeeId: "e-9" });
    expect(h.feature).not.toHaveBeenCalled();
  });

  it("features by approving first, then marking it featured", async () => {
    const order: string[] = [];
    h.approve.mockImplementation(async () => order.push("approve"));
    h.feature.mockImplementation(async () => order.push("feature"));
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: "Feature (+25)" }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith("Featured: +25 points for Jane Doe."));
    expect(order).toEqual(["approve", "feature"]);
    expect(h.feature).toHaveBeenCalledWith({ id: "x-1", employeeId: "e-9" });
  });

  it("doesn't feature when the approval fails, and explains why", async () => {
    h.approve.mockRejectedValue(problem(409, "NOT_PENDING"));
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: "Feature (+25)" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalled());
    expect(h.showError).toHaveBeenCalledWith("Someone has already decided on this post. Reload to see where it is now.");
    expect(h.feature).not.toHaveBeenCalled();
    expect(h.showSuccess).not.toHaveBeenCalled();
  });

  it("says the post was approved and can be featured from Approved when only featuring fails", async () => {
    h.feature.mockRejectedValue(problem(503, "DEPENDENCY_UNAVAILABLE"));
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: "Feature (+25)" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith(FEATURE_AFTER_APPROVE_FAILED));
    expect(FEATURE_AFTER_APPROVE_FAILED).toMatch(/approved/);
    expect(FEATURE_AFTER_APPROVE_FAILED).toMatch(/Approved tab/);
    expect(h.approve).toHaveBeenCalledTimes(1);
  });

  it("explains SELF_REVIEW from the server", async () => {
    h.approve.mockRejectedValue(problem(403, "SELF_REVIEW"));
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve (+10)" }));
    await waitFor(() =>
      expect(h.showError).toHaveBeenCalledWith("You can't decide on your own post; another marketing team member will."),
    );
  });

  it("opens the decline dialog", () => {
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(screen.getByText("Decline Jane Doe's post")).toBeTruthy();
  });

  it("hides the buttons on the reviewer's own post", () => {
    showList([share("x-1", "PENDING", { employeeId: "me-1" })]);
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByText(OWN_CLAIM_NOTE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve (+10)" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Feature/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
  });

  it("falls back to the employee id when neither a name nor an email is known", () => {
    h.person = { name: "Unknown employee", photoUrl: null, team: null, businessUnit: null };
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByText("An employee")).toBeTruthy();
    expect(screen.getByText("Employee ID: e-9")).toBeTruthy();
  });

  it("looks the person up by the name and email the review list sends, and shows the email", () => {
    showList([share("x-1", "PENDING", { employeeName: "Jane Doe", employeeEmail: "jane@choreolabs.test" })]);
    render(<ReviewTab status="PENDING" />);
    expect(h.lookups[0]).toEqual({ employeeId: "e-9", email: "jane@choreolabs.test", displayName: "Jane Doe" });
    const card = screen.getByRole("article", { name: "Post from Jane Doe" });
    expect(within(card).getByText("jane@choreolabs.test")).toBeTruthy();
    expect(within(card).queryByText(/Employee ID/)).toBeNull();
  });

  it("names the sender by email when only the email is known", () => {
    h.person = { name: "Unknown employee", photoUrl: null, team: null, businessUnit: null };
    showList([share("x-1", "PENDING", { employeeName: null, employeeEmail: "jane@choreolabs.test" })]);
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByRole("article", { name: "Post from jane@choreolabs.test" })).toBeTruthy();
    expect(screen.queryByText(/Employee ID/)).toBeNull();
  });
});

describe("the points on the decision buttons", () => {
  it("come from the values in force", async () => {
    h.values = { OWN_POST: 12, OWN_POST_AMPLIFIED: 30, REPOST: 2 };
    showList([share("x-1", "PENDING")]);
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByRole("button", { name: "Approve (+12)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Feature (+30)" }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith("Featured: +30 points for Jane Doe."));
  });

  it("offer the top-up, featured minus approved, on an approved post", async () => {
    h.values = { OWN_POST: 12, OWN_POST_AMPLIFIED: 30 };
    showList([share("x-2", "APPROVED")]);
    render(<ReviewTab status="APPROVED" />);
    fireEvent.click(screen.getByRole("button", { name: "Feature (+18)" }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith("Featured: +18 more points for Jane Doe."));
  });

  it("fall back to 10, 25 and 15 while the values load or lack an action", () => {
    h.values = { REPOST: 2 };
    showList([share("x-1", "PENDING"), share("x-2", "APPROVED")]);
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByRole("button", { name: "Approve (+10)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Feature (+25)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Feature (+15)" })).toBeTruthy();
  });
});

describe("other tabs", () => {
  it("offers only Feature (+15) on an approved post, and it only marks it featured", async () => {
    showList([share("x-2", "APPROVED", { decidedAt: "2026-11-21T00:00:00Z" })]);
    render(<ReviewTab status="APPROVED" />);
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Feature (+15)" }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith("Featured: +15 more points for Jane Doe."));
    expect(h.feature).toHaveBeenCalledWith({ id: "x-2", employeeId: "e-9" });
    expect(h.approve).not.toHaveBeenCalled();
  });

  it("offers no decision on featured or declined posts, and shows the decline reason", () => {
    showList([
      share("x-3", "AMPLIFIED", { amplifiedAt: "2026-11-22T00:00:00Z" }),
      share("x-4", "REJECTED", { decisionReason: "Other — not a post", decidedAt: "2026-11-22T00:00:00Z" }),
    ]);
    render(<ReviewTab status="AMPLIFIED" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Other — not a post/)).toBeTruthy();
  });

  it("says when a tab has nothing in it", () => {
    showList([]);
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByText("Nothing is waiting for review.")).toBeTruthy();
  });

  it("offers a retry when the list fails", () => {
    h.list = { ...h.list, data: undefined, isError: true, error: new Error("down") };
    render(<ReviewTab status="PENDING" />);
    expect(screen.getByText(/Couldn't load these posts/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("pages through a long list", () => {
    showList(
      Array.from({ length: 10 }, (_, i) => share(`p-${i}`, "PENDING")),
      23,
    );
    render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(h.listArgs.at(-1)).toEqual(["PENDING", 1]);
  });
});

describe("paging after decisions", () => {
  const firstPage = () => Array.from({ length: 10 }, (_, i) => share(`p-${i}`, "PENDING"));

  it("steps back a page when the last post on a later page is decided", async () => {
    showList(firstPage(), 11);
    const { rerender } = render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    showList([share("p-10", "PENDING")], 11);
    rerender(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve (+10)" }));
    await waitFor(() => expect(h.listArgs.at(-1)).toEqual(["PENDING", 0]));
  });

  it("offers the way back when a later page empties while open", () => {
    showList(firstPage(), 11);
    const { rerender } = render(<ReviewTab status="PENDING" />);
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    showList([], 10);
    rerender(<ReviewTab status="PENDING" />);
    expect(screen.getByText("This page is empty now.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to the first page" }));
    expect(h.listArgs.at(-1)).toEqual(["PENDING", 0]);
  });
});

describe("ReviewOwnPostsPage", () => {
  it("has the four tabs as links, with the waiting count on Waiting", () => {
    h.waiting = 4;
    showList([]);
    render(
      <MemoryRouter initialEntries={["/amplify/review/waiting"]}>
        <Routes>
          <Route path="/amplify/review" element={<ReviewOwnPostsPage />}>
            <Route path="waiting" element={<ReviewTab status="PENDING" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Review own posts" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("href"))).toEqual([
      "/amplify/review/waiting",
      "/amplify/review/approved",
      "/amplify/review/featured",
      "/amplify/review/declined",
    ]);
    expect(within(tabs[0]).getByText("4")).toBeTruthy();
  });
});
