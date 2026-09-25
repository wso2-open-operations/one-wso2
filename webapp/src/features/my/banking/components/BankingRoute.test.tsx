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
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

const access = vi.hoisted(() => ({
  value: {} as {
    canSee: boolean;
    isResolving: boolean;
    isError: boolean;
    errorMessage?: string;
    retry: () => void;
  },
}));
vi.mock("@features/my/api/useBankingAccess", () => ({ useBankingAccess: () => access.value }));

import BankingRoute from "./BankingRoute";

function UrlProbe() {
  return <div data-testid="url">{useLocation().pathname}</div>;
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/me/banking"]}>
      <UrlProbe />
      <Routes>
        <Route
          path="/me/banking"
          element={
            <BankingRoute>
              <div>the banking page</div>
            </BankingRoute>
          }
        />
        <Route path="/me" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  access.value = { canSee: true, isResolving: false, isError: false, retry: vi.fn() };
});

describe("BankingRoute", () => {
  it("renders the page for a caller the backend counts as an employee", () => {
    renderGuarded();
    expect(screen.getByText("the banking page")).toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/me/banking");
  });

  // The rail entry is hidden for them, but a hidden entry alone leaves the URL working.
  it("sends everyone else home", () => {
    access.value = { ...access.value, canSee: false };
    renderGuarded();
    expect(screen.queryByText("the banking page")).not.toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/me");
  });

  it("waits, rather than redirecting, while the backend has not answered yet", () => {
    access.value = { ...access.value, canSee: false, isResolving: true };
    renderGuarded();
    expect(screen.queryByText("the banking page")).not.toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/me/banking");
  });

  it("says the check failed, with a retry, instead of silently redirecting", () => {
    access.value = { ...access.value, canSee: false, isError: true, errorMessage: "boom" };
    renderGuarded();
    expect(screen.getByText(/Couldn't check your access to Banking/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByTestId("url")).toHaveTextContent("/me/banking");
  });
});
