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
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { inZone } from "@/test/timeZone";
import { misPaths } from "@constants/misApps";
import type { ArrSummaryState } from "@features/finance/mis/api/useArrSummary";

// The first real figures on screen. Everything below the shell: the Build's
// rows, one column group per Annual Period, at default filters.
//
// The fetch is stubbed at `useArrSummary` — the seam its own tests cover — so
// this file is about what a reader sees, not about how it was fetched.

vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: { userInfo: "https://mis.example/user-info" },
}));

// The page no longer calls /user-info, but MisShell's module graph still
// reaches @asgardeo/browser, which does not resolve under Node's ESM loader.
vi.mock("@features/finance/mis/api/useMisUserInfo", () => ({
  useMisUserInfo: () => ({ data: undefined, isPending: false, isError: false }),
}));

vi.mock("@features/finance/mis/api/useMisGate", () => ({
  useMisGate: () => ({
    canSee: () => true,
    isAuthorized: true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

const summary = { value: {} as ArrSummaryState };
vi.mock("@features/finance/mis/api/useArrSummary", () => ({
  useArrSummary: () => summary.value,
}));

const MisArrBuildPage = (await import("@features/finance/mis/pages/MisArrBuildPage")).default;

/** Five columns at Years Back 5, and this is the newest of them. */
const THIS_YEAR = "2025/12/31 - 2026/09/12";

const loaded = (response: Record<string, unknown>): ArrSummaryState => ({
  columns: [{ label: THIS_YEAR, response, isError: false }],
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

function renderPage(search = "") {
  return inZone("Asia/Colombo", () =>
    render(
      <MemoryRouter initialEntries={[`${misPaths.arrBuild}${search}`]}>
        <MisArrBuildPage />
      </MemoryRouter>,
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
  summary.value = loaded({ openingArr: 1_234_567.5 });
});

describe("while the figures are loading", () => {
  it("holds the space rather than showing an empty Build", () => {
    summary.value = { ...loaded({}), isLoading: true, columns: [] };
    renderPage();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("when every column fails", () => {
  it("says so, and offers the reader a way to try again", () => {
    summary.value = {
      columns: [],
      isLoading: false,
      isError: true,
      errorMessage: "Gateway timed out.",
      retry: () => {},
    };
    renderPage();
    expect(screen.getByText(/couldn't load the build/i)).toBeInTheDocument();
    // "Retry" is ErrorNotice's own word, shared by every screen in this app.
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("the Build itself", () => {
  it("renders the movement from an Opening balance to a Closing one", () => {
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Opening ARR")).toBeInTheDocument();
    expect(within(table).getByText("Ending ARR")).toBeInTheDocument();
  });

  it("heads each column with the two balance dates it spans", () => {
    renderPage();
    expect(screen.getByText(THIS_YEAR)).toBeInTheDocument();
  });

  it("opens every section, since a Subscription Build is a summary already", () => {
    renderPage();
    const table = screen.getByRole("table");
    for (const section of ["ARR movement", "Dollar retention", "Customers"]) {
      expect(within(table).getByText(section)).toBeInTheDocument();
    }
  });
});

describe("the figures", () => {
  it("are written as money at full value", () => {
    renderPage();
    expect(screen.getByText("1,234,567.50")).toBeInTheDocument();
  });

  it("are divided by a thousand when the link asks for thousands", () => {
    renderPage("?scale=k");
    expect(screen.getByText("1,234.57")).toBeInTheDocument();
  });

  it("leave a headcount alone at either Scale", () => {
    // Spec §3, the rule the whole of ticket 05 exists for: 1,234 customers are
    // 1,234 customers however the amounts are shown.
    summary.value = loaded({ openingSubscriptionCustomers: 1234 });
    renderPage("?scale=k");
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("say what they are in, so a cropped screenshot still states its units", () => {
    renderPage("?scale=k");
    expect(screen.getByText("All amounts in USD '000")).toBeInTheDocument();
  });

  it("leave a cell blank when the backend had nothing for that row", () => {
    summary.value = loaded({ openingArr: null });
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).queryByText("NaN")).not.toBeInTheDocument();
  });
});
