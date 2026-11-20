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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { umtPaths } from "../lib/umtPaths";

const state = vi.hoisted(() => ({
  uat: undefined as unknown,
  // What a fresh UAT fetch returns; undefined means unchanged.
  uatNow: undefined as unknown,
  create: vi.fn(async () => undefined),
}));

const UAT_STAGING = {
  recordsTotal: 2,
  recordsFiltered: 2,
  data: [
    { id: 11, lifecycle: "UpdateLifecycle", products: [{ product: { name: "wso2am", version: "4.2.0" } }] },
    {
      id: 12,
      lifecycle: "SecurityUpdateLifecycle",
      products: [{ product: { name: "wso2is", version: "7.2.0.4.full" } }],
    },
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
    refetch: async () => ({ isSuccess: true, data: state.uatNow ?? state.uat, dataUpdatedAt: Date.now() }),
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
    state.uatNow = undefined;
  });

  // Selecting the row is what makes the two cases differ: with a selection in
  // hand, the only thing left holding Create back is the UAT list.
  async function selectTheUpdate() {
    const [, rowCheckbox] = screen.getAllByRole("checkbox");
    await userEvent.click(rowCheckbox);
  }

  it("puts Create Release Chunk at the bottom right, below the grid", () => {
    state.uat = { recordsTotal: 0, recordsFiltered: 0, data: [] };
    renderPage();

    expect(createButton().parentElement).toHaveStyle({ display: "flex", justifyContent: "flex-end" });
    expect(screen.getByRole("grid").compareDocumentPosition(createButton())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

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

  it("checks against UAT as it is when Create is clicked, not as the page loaded it", async () => {
    state.uat = {
      recordsTotal: 1,
      recordsFiltered: 1,
      data: [{ id: 99, products: [{ product: { name: "wso2am", version: "4.2.0" } }] }],
    };
    state.uatNow = { recordsTotal: 0, recordsFiltered: 0, data: [] };
    renderPage();

    await selectTheUpdate();
    await userEvent.click(createButton());
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Create$/ }));

    expect(screen.queryByText("Cannot Promote Updates")).not.toBeInTheDocument();
    expect(state.create).toHaveBeenCalledWith([11]);
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

  // A restored id with no row behind it was never checked against UAT and is
  // not shown ticked, so it must not reach the request.
  it("submits only the restored updates that are on screen", async () => {
    state.uat = { recordsTotal: 0, recordsFiltered: 0, data: [] };
    render(
      <MemoryRouter initialEntries={[{ pathname: umtPaths.newReleaseChunk, state: { selectedIds: [11, 42] } }]}>
        <UmtCreateReleaseChunkPage />
      </MemoryRouter>,
    );

    await userEvent.click(createButton());
    await userEvent.click(await screen.findByRole("button", { name: /^Create$/ }));

    expect(state.create).toHaveBeenCalledWith([11]);
  });

  it("refuses to create when none of the restored updates are on screen", () => {
    state.uat = { recordsTotal: 0, recordsFiltered: 0, data: [] };
    render(
      <MemoryRouter initialEntries={[{ pathname: umtPaths.newReleaseChunk, state: { selectedIds: [42] } }]}>
        <UmtCreateReleaseChunkPage />
      </MemoryRouter>,
    );

    expect(createButton()).toBeDisabled();
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
      backState: { selectedIds: [11], search: "", lifecycle: "" },
    });
  });

  describe("filters", () => {
    const AM = "wso2am - 4.2.0";
    const IS = "wso2is - 7.2.0.4.full";
    const searchBox = () => screen.getByPlaceholderText(/Search by product/);

    it("matches the search against name-version, ignoring spaces and case", async () => {
      renderPage();

      await userEvent.type(searchBox(), "WSO2IS - 7.2.0.4");

      expect(screen.getByText(IS)).toBeInTheDocument();
      expect(screen.queryByText(AM)).not.toBeInTheDocument();
    });

    it("shows only updates of the chosen lifecycle", async () => {
      renderPage();

      await userEvent.click(screen.getByRole("combobox", { name: /Lifecycle/ }));
      await userEvent.click(screen.getByRole("option", { name: "SecurityUpdateLifecycle" }));

      expect(screen.getByText(IS)).toBeInTheDocument();
      expect(screen.queryByText(AM)).not.toBeInTheDocument();
    });

    it("restores the search and lifecycle kept in its history entry", () => {
      render(
        <MemoryRouter
          initialEntries={[
            {
              pathname: umtPaths.newReleaseChunk,
              state: { selectedIds: [], search: "wso2is", lifecycle: "SecurityUpdateLifecycle" },
            },
          ]}
        >
          <UmtCreateReleaseChunkPage />
        </MemoryRouter>,
      );

      expect(searchBox()).toHaveValue("wso2is");
      expect(screen.getByText(IS)).toBeInTheDocument();
      expect(screen.queryByText(AM)).not.toBeInTheDocument();
    });

    // A tick on a row the search hides stays, select-all adds only the rows
    // on screen, and the confirmation lists every update that goes in.
    it("keeps ticks on hidden rows and lists them before creating", async () => {
      state.uat = { recordsTotal: 0, recordsFiltered: 0, data: [] };
      renderPage();

      await selectTheUpdate();
      await userEvent.type(searchBox(), "wso2is");
      const [selectAll] = screen.getAllByRole("checkbox");
      await userEvent.click(selectAll);
      await userEvent.click(createButton());

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(AM)).toBeInTheDocument();
      expect(within(dialog).getByText(IS)).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole("button", { name: /^Create$/ }));
      expect(state.create).toHaveBeenCalledWith([11, 12]);
    });
  });
});
