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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import IsacShell from "./IsacShell";

const configured = vi.hoisted(() => ({ value: true }));
vi.mock("@config/apiConfig", () => ({
  isIsacBackendConfigured: () => configured.value,
}));

interface Me {
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}
const READY: Me = { isPending: false, isError: false, isRefetching: false, error: null, refetch: async () => undefined };
const me = vi.hoisted(() => ({ value: {} as Me, enabledWith: [] as boolean[] }));
vi.mock("../api/queries", () => ({
  useIsacMe: (enabled: boolean) => {
    me.enabledWith.push(enabled);
    return me.value;
  },
}));

function renderShell(state: Partial<Me> = {}) {
  me.value = { ...READY, ...state };
  return render(
    <MemoryRouter initialEntries={["/marketing-ops/isac/dashboard"]}>
      <Routes>
        <Route path="/marketing-ops/isac" element={<IsacShell />}>
          <Route path="dashboard" element={<div>the screen</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  configured.value = true;
  me.enabledWith = [];
});

describe("IsacShell", () => {
  it("names the missing config key and asks nothing when the ISAC API is not configured", () => {
    configured.value = false;
    renderShell({ isPending: true });
    expect(screen.getByText("ONE_WSO2_MARKETINGOPS_ISAC_BACKEND_URL")).toBeInTheDocument();
    expect(screen.queryByText("the screen")).not.toBeInTheDocument();
    expect(me.enabledWith.every((enabled) => enabled === false)).toBe(true);
  });

  it("waits, without showing the screen, while access is being checked", () => {
    renderShell({ isPending: true });
    expect(screen.getByText(/Checking your ISAC access/)).toBeInTheDocument();
    expect(screen.queryByText("the screen")).not.toBeInTheDocument();
  });

  it("reports a failed check as an error that can be retried, not as a denial", async () => {
    const refetch = vi.fn(async () => undefined);
    renderShell({ isError: true, error: new Error("Gateway timeout"), refetch });
    expect(screen.getByText(/Couldn't check your ISAC access/)).toBeInTheDocument();
    expect(screen.getByText(/Gateway timeout/)).toBeInTheDocument();
    expect(screen.queryByText("the screen")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the screen once the ISAC API has answered", () => {
    renderShell();
    expect(screen.getByText("the screen")).toBeInTheDocument();
  });
});
