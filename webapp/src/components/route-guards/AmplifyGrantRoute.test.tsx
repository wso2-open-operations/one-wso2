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
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";

type Access = { hasAccess: boolean; isResolving: boolean; error?: string; retry: () => void };

const access = vi.hoisted(() => ({
  review: { hasAccess: false, isResolving: false, retry: () => undefined } as Access,
  points: { hasAccess: false, isResolving: false, retry: () => undefined } as Access,
  admin: { hasAccess: false, isResolving: false, retry: () => undefined } as Access,
}));

vi.mock("@features/amplify/api/useAmplifyEditorAccess", () => ({
  useAmplifyReviewAccess: () => access.review,
  useAmplifyPointsAccess: () => access.points,
  useAmplifyAdminAccess: () => access.admin,
}));

import { AmplifyAdminRoute, AmplifyPointsRoute, AmplifyReviewRoute } from "./AmplifyGrantRoute";

const closed = (): Access => ({ hasAccess: false, isResolving: false, error: undefined, retry: () => undefined });

beforeEach(() => {
  access.review = closed();
  access.points = closed();
  access.admin = closed();
});

const guards = [
  ["Review own posts", "review", AmplifyReviewRoute, "/amplify/review"],
  ["Points & corrections", "points", AmplifyPointsRoute, "/amplify/points"],
  ["Amplify Admin", "admin", AmplifyAdminRoute, "/amplify/admin"],
] as const;

function renderAt(Guard: (p: { children: ReactNode }) => ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/amplify/celebrate" element={<div>celebrate page</div>} />
        <Route
          path={path}
          element={
            <Guard>
              <div>the screen</div>
            </Guard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe.each(guards)("%s route", (_name, key, Guard, path) => {
  it("opens the screen for its grant", () => {
    access[key].hasAccess = true;
    renderAt(Guard, path);
    expect(screen.getByText("the screen")).toBeTruthy();
  });

  it("sends everyone else to Celebrate", () => {
    renderAt(Guard, path);
    expect(screen.getByText("celebrate page")).toBeTruthy();
    expect(screen.queryByText("the screen")).toBeNull();
  });

  it("renders nothing, and doesn't redirect, while /me loads", () => {
    access[key].isResolving = true;
    const { container } = renderAt(Guard, path);
    expect(container.textContent).toBe("");
  });

  it("explains a failed access check instead of redirecting", () => {
    access[key].error = "boom";
    renderAt(Guard, path);
    expect(screen.getByText(/check your access/i)).toBeTruthy();
    expect(screen.queryByText("celebrate page")).toBeNull();
  });

  it("isn't opened by another screen's grant", () => {
    for (const other of ["review", "points", "admin"] as const) if (other !== key) access[other].hasAccess = true;
    renderAt(Guard, path);
    expect(screen.queryByText("the screen")).toBeNull();
  });
});
