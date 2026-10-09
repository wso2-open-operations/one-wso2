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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// Creating a release chunk is gated on the UAT list being in hand. The check
// it feeds asks whether any selected update's product already has an update
// sitting in UAT, so with no UAT list to compare against it finds nothing and
// reports the selection clear — indistinguishable from a genuinely clear
// selection, and a chunk created past a conflict is not something the screen
// can take back.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { umtPaths } from "../lib/umtPaths";

const state = vi.hoisted(() => ({
  uat: undefined as unknown,
  create: vi.fn(async () => undefined),
}));

const UAT_STAGING = {
  recordsTotal: 1,
  recordsFiltered: 1,
  data: [
    { id: 11, lifecycle: "UpdateLifecycle", products: [{ product: { name: "wso2am", version: "4.2.0" } }] },
  ],
};

vi.mock("../api/useUmtGate", () => ({
  useUmtGate: () => ({
    isAuthorized: true,
    isUser: true,
    isAdmin: true,
    isProductLead: false,
    hasRole: () => true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

vi.mock("../api/useUmtUpdates", () => ({
  useUmtUpdatesByLifecycleState: (lifecycleState: string) => ({
    data: lifecycleState === "UATStaging" ? UAT_STAGING : state.uat,
    isError: false,
    isFetching: false,
    isPending: lifecycleState === "UATStaging" ? false : state.uat === undefined,
    error: null,
    refetch: () => {},
  }),
}));

vi.mock("../api/useUmtReleaseChunkActions", () => ({
  useUmtCreateReleaseChunk: () => ({ isPending: false, mutateAsync: state.create }),
}));

vi.mock("../components/UmtShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => vi.fn() };
});

const { default: UmtCreateReleaseChunkPage } = await import("./UmtCreateReleaseChunkPage");

// The grid's per-row link needs a router around it.
const renderPage = () =>
  render(
    <MemoryRouter>
      <UmtCreateReleaseChunkPage />
    </MemoryRouter>,
  );

const createButton = () => screen.getByRole("button", { name: /Create Release Chunk/i });

describe("UmtCreateReleaseChunkPage", () => {
  beforeEach(() => {
    state.create.mockClear();
  });

  // Selecting the row is what makes the two cases differ: with a selection in
  // hand, the only thing left holding Create back is the UAT list.
  async function selectTheUpdate() {
    const [, rowCheckbox] = screen.getAllByRole("checkbox");
    await userEvent.click(rowCheckbox);
  }

  it("refuses to create while the UAT list it validates against is missing", async () => {
    state.uat = undefined;
    renderPage();

    await selectTheUpdate();

    expect(createButton()).toBeDisabled();
    expect(state.create).not.toHaveBeenCalled();
  });

  // An empty UAT list is an answer — nothing is in UAT, so nothing can clash.
  it("allows creation once UAT has answered, even with nothing in it", async () => {
    state.uat = { recordsTotal: 0, recordsFiltered: 0, data: [] };
    renderPage();

    await selectTheUpdate();

    expect(createButton()).toBeEnabled();
  });

  it("blocks a selection whose product already has an update in UAT", async () => {
    state.uat = {
      recordsTotal: 1,
      recordsFiltered: 1,
      data: [{ id: 99, products: [{ product: { name: "wso2am", version: "4.2.0" } }] }],
    };
    renderPage();

    await selectTheUpdate();
    await userEvent.click(createButton());

    expect(await screen.findByText("Cannot Promote Updates")).toBeInTheDocument();
    expect(state.create).not.toHaveBeenCalled();
  });

  it("restores the selection kept in its history entry", () => {
    state.uat = { recordsTotal: 0, recordsFiltered: 0, data: [] };
    render(
      <MemoryRouter initialEntries={[{ pathname: umtPaths.newReleaseChunk, state: { selectedIds: [11] } }]}>
        <UmtCreateReleaseChunkPage />
      </MemoryRouter>,
    );

    const [, rowCheckbox] = screen.getAllByRole("checkbox");
    expect(rowCheckbox).toBeChecked();
    expect(createButton()).toBeEnabled();
  });

  it("links to an update with a way back that keeps the selection", async () => {
    state.uat = { recordsTotal: 0, recordsFiltered: 0, data: [] };
    function LocationState() {
      return <pre data-testid="location-state">{JSON.stringify(useLocation().state)}</pre>;
    }
    render(
      <MemoryRouter initialEntries={[umtPaths.newReleaseChunk]}>
        <Routes>
          <Route path={umtPaths.newReleaseChunk} element={<UmtCreateReleaseChunkPage />} />
          <Route path={umtPaths.update(":id")} element={<LocationState />} />
        </Routes>
      </MemoryRouter>,
    );

    await selectTheUpdate();
    await userEvent.click(screen.getByRole("link", { name: "View update 11" }));

    expect(JSON.parse(screen.getByTestId("location-state").textContent ?? "null")).toEqual({
      backTo: umtPaths.newReleaseChunk,
      backState: { selectedIds: [11] },
    });
  });
});
