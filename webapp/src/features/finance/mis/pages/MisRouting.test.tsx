/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

// Test checklist §10.10, §10.11 and §10.12 — what a person actually SEES at a
// MIS URL they are and are not entitled to.
//
// The two privileges are independent, so there are three populations here, not
// two: ARR-only, Flash-only, and neither. The gate suite proves the decision;
// this proves the decision reaches the screen.
//
// Typing a URL you cannot use gives a locked panel, NOT a redirect. A redirect
// would bounce the reader somewhere without saying why, and a bookmarked link
// that silently lands elsewhere reads as the app being broken.

const state = {
  allow: new Set<string>(),
  isAuthorized: false,
  isResolving: false,
};

vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
}));

vi.mock("../api/useMisGate", () => ({
  useMisGate: () => ({
    canSee: (id: string) => state.allow.has(id),
    isAuthorized: state.isAuthorized,
    isResolving: state.isResolving,
    isError: false,
    retry: () => {},
  }),
}));

// The ARR page reads /user-info directly for its privilege readout. Mocked at
// the hook rather than at the HTTP layer because what is under test here is
// routing and access, not the wire format.
vi.mock("../api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({ data: { privileges: [987] } }),
}));

// Same reason, one layer along: the ARR Build's figures come through
// useArrSummary, which reaches @asgardeo/react for a token. Routing does not
// care what the Build says, only that it is the thing that rendered.
vi.mock("../api/useArrSummary", () => ({
  useArrSummary: () => ({
    columns: [],
    isLoading: false,
    isError: false,
    errorMessage: "",
    retry: () => {},
  }),
}));

const { default: MisArrBuildPage } = await import("./MisArrBuildPage");
const { default: MisFlashPage } = await import("./MisFlashPage");

function show(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/finance/mis/arr-build" element={<MisArrBuildPage />} />
        <Route path="/finance/mis/flash" element={<MisFlashPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.allow = new Set();
  state.isAuthorized = false;
  state.isResolving = false;
});

describe("someone holding only the ARR privilege", () => {
  beforeEach(() => {
    state.allow = new Set(["mis-arr-build", "mis-qrr-build", "mis-mrr-build", "mis-analysis"]);
    state.isAuthorized = true;
  });

  it("gets ARR Build", () => {
    show("/finance/mis/arr-build");
    expect(screen.getByRole("heading", { name: "ARR Build" })).toBeInTheDocument();
  });

  // §10.10. Not a redirect, and not the "no MIS access" copy either — they do
  // have MIS access, just not this half of it.
  it("is refused the Flash Dashboard, and told which half they hold", () => {
    show("/finance/mis/flash");
    expect(screen.getByText(/not one of the mis screens you can open/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access to finance mis/i)).not.toBeInTheDocument();
  });
});

describe("someone holding only the Flash privilege", () => {
  beforeEach(() => {
    state.allow = new Set(["mis-flash"]);
    state.isAuthorized = true;
  });

  it("gets the Flash Dashboard", () => {
    show("/finance/mis/flash");
    expect(screen.getByRole("heading", { name: "Flash Dashboard" })).toBeInTheDocument();
  });

  // §10.11. The mirror image, which is the case most likely to be got wrong:
  // /user-info comes from the ARR backend, so it is tempting to treat any
  // answer from it as ARR access.
  it("is refused ARR Build", () => {
    show("/finance/mis/arr-build");
    expect(screen.getByText(/not one of the mis screens you can open/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /what it returned for you/i })).not.toBeInTheDocument();
  });
});

// §10.12. Being signed in is not a MIS privilege — which is precisely what 987
// means everywhere else in this app, and why this is the case that would
// regress silently.
describe("someone holding neither privilege", () => {
  it("is refused both screens, and told they have no MIS access at all", () => {
    show("/finance/mis/arr-build");
    expect(screen.getByText(/don't have access to finance mis/i)).toBeInTheDocument();
  });

  it("is refused the Flash Dashboard too", () => {
    show("/finance/mis/flash");
    expect(screen.getByText(/don't have access to finance mis/i)).toBeInTheDocument();
  });
});

describe("while the privilege check is still in flight", () => {
  it("shows neither the screen nor a denial", () => {
    state.isResolving = true;
    show("/finance/mis/arr-build");
    expect(screen.getByText(/checking your mis access/i)).toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
  });
});

describe("the browser tab", () => {
  it("is named after the screen, not just the app", () => {
    state.allow = new Set(["mis-arr-build"]);
    state.isAuthorized = true;
    show("/finance/mis/arr-build");
    expect(document.title).toBe("ARR Build · One WSO2");
  });
});
