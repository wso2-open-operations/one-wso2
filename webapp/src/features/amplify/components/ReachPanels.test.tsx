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

const h = vi.hoisted(() => ({
  reach: undefined as unknown as Record<string, unknown>,
  turnOn: vi.fn(async () => undefined),
  turnOff: vi.fn(async () => undefined),
}));
vi.mock("../api/useAmplifyData", () => ({ useReachConnection: () => h.reach }));
vi.mock("../api/useReachToggle", () => ({ useReachToggle: () => ({ turnOn: h.turnOn, turnOff: h.turnOff, busy: false }) }));

import { ReachCard, ReachConnectionRow } from "./ReachPanels";

const loaded = (status: string) => ({
  isPending: false,
  isError: false,
  data: { connected: status === "CONNECTED", status, connectedAt: null, accessExpiresAt: null },
});

beforeEach(() => {
  h.turnOn.mockClear();
  h.turnOff.mockClear();
});

describe("ReachCard", () => {
  it("invites the employee to allow reach while it is off", () => {
    h.reach = loaded("NOT_CONNECTED");
    render(<ReachCard />);
    expect(screen.getByText("See how far your reposts travel")).toBeTruthy();
    expect(screen.getByText(/Optional: everything else works without it\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Allow reach on LinkedIn" }));
    expect(h.turnOn).toHaveBeenCalledTimes(1);
  });

  it("says reach is on, with Turn off reach", () => {
    h.reach = loaded("CONNECTED");
    render(<ReachCard />);
    expect(screen.getByText("Reach is on")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Turn off reach" }));
    expect(h.turnOff).toHaveBeenCalledTimes(1);
  });

  it("asks to allow it again after the token lapsed", () => {
    h.reach = loaded("EXPIRED");
    render(<ReachCard />);
    fireEvent.click(screen.getByRole("button", { name: "Allow reach again" }));
    expect(h.turnOn).toHaveBeenCalledTimes(1);
  });

  it("shows nothing while loading or when the status can't be read", () => {
    h.reach = { isPending: true, isError: false };
    const { container, rerender } = render(<ReachCard />);
    expect(container.textContent).toBe("");
    h.reach = { isPending: false, isError: true };
    rerender(<ReachCard />);
    expect(container.textContent).toBe("");
  });
});

describe("ReachConnectionRow", () => {
  it("shows reach off with Allow reach", () => {
    h.reach = loaded("NOT_CONNECTED");
    render(<ReachConnectionRow />);
    expect(screen.getByText("Off")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Allow reach" }));
    expect(h.turnOn).toHaveBeenCalledTimes(1);
  });

  it("shows reach on with Turn off", () => {
    h.reach = loaded("CONNECTED");
    render(<ReachConnectionRow />);
    expect(screen.getByText("On")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(h.turnOff).toHaveBeenCalledTimes(1);
  });

  it("asks to allow it again after the token lapsed", () => {
    h.reach = loaded("EXPIRED");
    render(<ReachConnectionRow />);
    expect(screen.getByText("Needs allowing again")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Allow again" })).toBeTruthy();
  });
});
