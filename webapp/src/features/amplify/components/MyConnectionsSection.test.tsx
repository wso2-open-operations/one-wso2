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
import { fireEvent, render, screen } from "@testing-library/react";

let me: { isPending: boolean; isError: boolean; data?: unknown } = { isPending: false, isError: false };
vi.mock("../api/useAmplifyData", () => ({ useAmplifyMe: () => me }));
vi.mock("./LinkLinkedInDialog", () => ({
  default: ({ open, returnTo }: { open: boolean; returnTo: string }) =>
    open ? <div>link dialog returns to {returnTo}</div> : null,
}));
vi.mock("./RemoveLinkedInDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>remove dialog</div> : null),
}));

import MyConnectionsSection from "./MyConnectionsSection";

const withStatus = (status: string, expiresAt: string | null = null) => {
  me = { isPending: false, isError: false, data: { linkedin: { status, expiresAt } } };
};

describe("MyConnectionsSection", () => {
  beforeEach(() => withStatus("NOT_CONNECTED"));

  it("offers Link me when not connected, returning to Settings after LinkedIn", () => {
    render(<MyConnectionsSection />);
    expect(screen.getByText("Not connected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Link me" }));
    expect(screen.getByText("link dialog returns to /settings")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove connection" })).toBeNull();
  });

  it("offers Remove connection when connected and opens the confirmation", () => {
    withStatus("ACTIVE", "2026-12-24T00:00:00Z");
    render(<MyConnectionsSection />);
    expect(screen.getByText("Connected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove connection" }));
    expect(screen.getByText("remove dialog")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link me" })).toBeNull();
  });

  it("offers Link again, and still Remove, when the link needs reconnecting", () => {
    withStatus("NEEDS_RECONNECT");
    render(<MyConnectionsSection />);
    expect(screen.getByRole("button", { name: "Link again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove connection" })).toBeTruthy();
  });

  it("says so when the status can't be loaded", () => {
    me = { isPending: false, isError: true };
    render(<MyConnectionsSection />);
    expect(screen.getByText(/Couldn't load your LinkedIn connection/)).toBeTruthy();
  });
});
