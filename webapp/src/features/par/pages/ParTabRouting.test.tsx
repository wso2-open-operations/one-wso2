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
import type { ReactNode } from "react";

// Mocked at the query layer rather than at useParHasLead, so the real gate
// formula is what runs here.
const employeeInfo: { isSuccess: boolean; data?: { leadEmail: string | null } } = {
  isSuccess: false,
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "par-employee-info" ? employeeInfo : { data: undefined },
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const profile = { data: { userInfo: { workEmail: "someone@wso2.com" } }, isLoading: false };
vi.mock("@features/my/api/useMeProfile", () => ({ useMeProfile: () => profile }));

vi.mock("../components/ParShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: ParGroupPage, ParGroupIndex, ParRequiresLeadRoute } = await import(
  "./ParGroupPage"
);

/** Always mounted, so a redirect is visible even when the route renders nothing. */
function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

function Tab({ name }: { name: string }) {
  return <div data-testid="tab-body">{name}</div>;
}

beforeEach(() => {
  employeeInfo.isSuccess = false;
  employeeInfo.data = undefined;
  profile.isLoading = false;
});

function hasLead(leadEmail: string | null) {
  employeeInfo.isSuccess = true;
  employeeInfo.data = { leadEmail };
}

/** The group, wired the way App.tsx wires it. */
function show(initial = "/people-ops/performance") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route path="/people-ops/performance" element={<ParGroupPage />}>
          <Route index element={<ParGroupIndex />} />
          <Route
            path="employee-feedback"
            element={
              <ParRequiresLeadRoute>
                <Tab name="Employee Feedback" />
              </ParRequiresLeadRoute>
            }
          />
          <Route
            path="request-360"
            element={
              <ParRequiresLeadRoute>
                <Tab name="Request 360" />
              </ParRequiresLeadRoute>
            }
          />
          <Route path="provide-360" element={<Tab name="Provide 360" />} />
          <Route
            path="f2f"
            element={
              <ParRequiresLeadRoute>
                <Tab name="F2F" />
              </ParRequiresLeadRoute>
            }
          />
          <Route path="history" element={<Tab name="History" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("an employee who has a lead", () => {
  beforeEach(() => hasLead("lead@wso2.com"));

  it("sees all five tabs", async () => {
    show();
    expect(await screen.findByRole("tab", { name: "Employee Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Request 360° Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Provide 360° Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "F2F" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PAR History" })).toBeInTheDocument();
  });

  it("lands on Employee Feedback, so the group URL is never blank", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent(
      "/people-ops/performance/employee-feedback",
    );
  });
});

describe("an employee with no lead", () => {
  beforeEach(() => hasLead(null));

  it("sees only Provide 360° and History", async () => {
    show();
    await screen.findByRole("tab", { name: "Provide 360° Feedback" });
    expect(screen.getByRole("tab", { name: "PAR History" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Employee Feedback" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Request 360° Feedback" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "F2F" })).not.toBeInTheDocument();
  });

  it("lands on Provide 360°, not a tab they don't have", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance/provide-360");
  });

  // Hiding a tab is not the gate — the URL can be typed or bookmarked.
  it("is redirected away from a tab reached by its URL", async () => {
    show("/people-ops/performance/employee-feedback");
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance/provide-360");
    expect(screen.getByTestId("tab-body")).toHaveTextContent("Provide 360");
  });

  it("is redirected away from Request 360° too", async () => {
    show("/people-ops/performance/request-360");
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance/provide-360");
  });

  it("is redirected away from F2F too", async () => {
    show("/people-ops/performance/f2f");
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance/provide-360");
  });

  it("still reaches the tabs they do have", async () => {
    show("/people-ops/performance/history");
    expect(await screen.findByTestId("tab-body")).toHaveTextContent("History");
  });
});

// Deliberate: a slow or failed lookup must not hide tabs from someone who does
// have a lead. Access is enforced server-side, not by which tabs render.
describe("before the lookup has answered", () => {
  it("shows every tab rather than the leadless set", async () => {
    employeeInfo.isSuccess = false;
    show();
    expect(await screen.findByRole("tab", { name: "Employee Feedback" })).toBeInTheDocument();
  });

  it("serves a deep-linked gated tab rather than redirecting", async () => {
    employeeInfo.isSuccess = false;
    show("/people-ops/performance/employee-feedback");
    expect(await screen.findByTestId("tab-body")).toHaveTextContent("Employee Feedback");
  });

  it("sends nobody anywhere while the signed-in email is still loading", async () => {
    profile.isLoading = true;
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
