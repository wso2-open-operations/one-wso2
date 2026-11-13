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
import { HttpError } from "@api/http";
import { me } from "../../testing/fixtures";

// NothingHere comes from PerspectiveLanding, whose visibility hook pulls
// @asgardeo/browser into the module graph; stubbed as the other shell tests do.
vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({
    resolveVisible: () => true,
    isResolving: false,
    visibleLeaves: [],
    isError: false,
    retry: () => {},
  }),
}));

const state = vi.hoisted(() => ({
  configured: true,
  me: { data: undefined as unknown, isPending: false, isLoading: false, isError: false, error: null as unknown },
}));
const refetch = vi.fn();
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isSwagStoreBackendConfigured: () => state.configured,
}));
vi.mock("../../api/useSwagStoreUserInfo", () => ({
  useSwagStoreUserInfo: () => ({ ...state.me, refetch }),
}));
// The page has its own test; here it only needs to say it rendered.
vi.mock("../pages/DashboardPage", () => ({ default: () => <h1>Dashboard page</h1> }));

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation } from "react-router";
import { swagStoreAdminRoutes } from "../../routes";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function open(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      <Routes>{swagStoreAdminRoutes}</Routes>
    </MemoryRouter>,
  );
}

const asAdmin = (roles: ("catalog_manager" | "fulfilment_ops")[]) => {
  state.me = { data: me({ roles }), isPending: false, isLoading: false, isError: false, error: null };
};

beforeEach(() => {
  state.configured = true;
  asAdmin(["catalog_manager"]);
  refetch.mockClear();
});

describe("the Swag Store admin access ladder", () => {
  it("names the key to set when the backend isn't configured", () => {
    state.configured = false;
    open("/people-ops/swag-store/dashboard");
    expect(screen.getByText(/ONE_WSO2_SWAG_STORE_BACKEND_URL/)).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).toBeNull();
  });

  it("holds the page and redirects nowhere while access is checked", () => {
    state.me = { data: undefined, isPending: true, isLoading: true, isError: false, error: null };
    open("/people-ops/swag-store/dashboard");
    expect(screen.getByText(/Checking your Swag Store access/)).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/people-ops/swag-store/dashboard");
  });

  it("reports a failed check with Retry, never as no access", async () => {
    state.me = { data: undefined, isPending: false, isLoading: false, isError: true, error: new HttpError("/users/me", 503, "") };
    open("/people-ops/swag-store/dashboard");
    expect(screen.getByText(/Couldn't check your Swag Store access/)).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it("tells a shopper with no store role that the screens are for the store team", () => {
    asAdmin([]);
    open("/people-ops/swag-store/dashboard");
    expect(screen.getByText(/for the Swag Store team/)).toBeInTheDocument();
    expect(screen.getByText(/People Ops grants access/)).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).toBeNull();
  });

  it("shows the shared card to someone outside WSO2", () => {
    state.me = {
      data: undefined,
      isPending: false,
      isLoading: false,
      isError: true,
      error: new HttpError("/users/me", 403, JSON.stringify({ message: "m", errorCode: "not_wso2" })),
    };
    open("/people-ops/swag-store/dashboard");
    expect(screen.queryByText(/Couldn't check/)).toBeNull();
    expect(screen.queryByText("Dashboard page")).toBeNull();
  });

  it("opens the screen for a store admin", async () => {
    asAdmin(["fulfilment_ops"]);
    open("/people-ops/swag-store/dashboard");
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("sends the landing to the first screen the person may use", async () => {
    open("/people-ops/swag-store");
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/people-ops/swag-store/dashboard");
  });
});
