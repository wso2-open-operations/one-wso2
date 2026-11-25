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
import type { ExternalShare } from "../api/amplifyTypes";

const h = vi.hoisted(() => ({
  mine: { data: [] as unknown[] | undefined, isError: false, error: null as unknown, refetch: () => undefined },
}));
vi.mock("../api/useAmplifyData", () => ({ useMyExternalShares: () => h.mine }));
vi.mock("./SubmitOwnPostDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>submit dialog</div> : null),
}));

import OwnPostPanel, { OWN_POSTS_SHOWN } from "./OwnPostPanel";

const share = (id: string, status: ExternalShare["status"], extra: Partial<ExternalShare> = {}): ExternalShare => ({
  id,
  employeeId: "e-1",
  action: "OWN_POST",
  evidenceUrl: `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`,
  evidenceHost: "www.linkedin.com",
  evidenceProvider: "linkedin",
  status,
  createdAt: "2026-11-20T10:00:00Z",
  version: 1,
  ...extra,
});

describe("OwnPostPanel", () => {
  beforeEach(() => {
    h.mine = { data: [], isError: false, error: null, refetch: () => undefined };
  });

  it("prompts for an own post and opens the dialog", () => {
    render(<OwnPostPanel />);
    expect(screen.getByText(/Wrote your own LinkedIn post about Choreo Labs\? Submit it for extra points/)).toBeTruthy();
    expect(screen.queryByText("submit dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit your own post" }));
    expect(screen.getByText("submit dialog")).toBeTruthy();
  });

  it("lists each submission with its status, and the reason for a declined one", () => {
    h.mine.data = [
      share("1", "PENDING"),
      share("2", "APPROVED"),
      share("3", "AMPLIFIED"),
      share("4", "REJECTED", { decisionReason: "Not about Choreo Labs" }),
    ];
    render(<OwnPostPanel />);
    const list = screen.getByRole("list", { name: "Posts you submitted" });
    expect(within(list).getByText("Waiting for review")).toBeTruthy();
    expect(within(list).getByText("Approved")).toBeTruthy();
    expect(within(list).getByText("Featured")).toBeTruthy();
    expect(within(list).getByText("Declined")).toBeTruthy();
    expect(within(list).getByText("Reason: Not about Choreo Labs")).toBeTruthy();
    const links = within(list).getAllByRole("link", { name: /Open on LinkedIn/ });
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("lists only the latest few", () => {
    h.mine.data = Array.from({ length: OWN_POSTS_SHOWN + 3 }, (_, i) => share(String(i), "PENDING"));
    render(<OwnPostPanel />);
    expect(within(screen.getByRole("list", { name: "Posts you submitted" })).getAllByRole("listitem")).toHaveLength(
      OWN_POSTS_SHOWN,
    );
  });

  it("doesn't link a stored address that isn't http(s)", () => {
    h.mine.data = [share("1", "PENDING", { evidenceUrl: "javascript:alert(1)" })];
    render(<OwnPostPanel />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says when the list couldn't load, and still offers the button", () => {
    h.mine = { data: undefined, isError: true, error: new Error("down"), refetch: () => undefined };
    render(<OwnPostPanel />);
    expect(screen.getByText(/Couldn't load the posts you submitted/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit your own post" })).toBeTruthy();
  });
});
