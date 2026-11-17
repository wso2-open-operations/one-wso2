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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import AmplifyPeopleOpsRoute from "./AmplifyPeopleOpsRoute";

const access = vi.hoisted(() => ({
  value: { hasAccess: false, isResolving: false, error: undefined as string | undefined, retry: () => undefined },
}));

vi.mock("@features/amplify/api/useAmplifyEditorAccess", () => ({
  useAmplifyPeopleOpsAccess: () => access.value,
}));

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/amplify/dashboards/team"]}>
      <Routes>
        <Route path="/amplify/celebrate" element={<div>celebrate page</div>} />
        <Route
          path="/amplify/dashboards/team"
          element={
            <AmplifyPeopleOpsRoute>
              <div>board</div>
            </AmplifyPeopleOpsRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  access.value = { hasAccess: false, isResolving: false, error: undefined, retry: () => undefined };
});

describe("AmplifyPeopleOpsRoute", () => {
  it("opens Team for a People Operations role", () => {
    access.value.hasAccess = true;
    renderAt();
    expect(screen.getByText("board")).toBeTruthy();
  });

  it("sends someone without CAN_PEOPLE_OPS to Celebrate", () => {
    renderAt();
    expect(screen.getByText("celebrate page")).toBeTruthy();
    expect(screen.queryByText("board")).toBeNull();
  });

  it("renders nothing while the token is being decoded", () => {
    access.value.isResolving = true;
    const { container } = renderAt();
    expect(container.textContent).toBe("");
  });

  it("explains a failed access check instead of redirecting", () => {
    access.value.error = "decode failed";
    renderAt();
    expect(screen.getByText(/check your access/i)).toBeTruthy();
    expect(screen.queryByText("celebrate page")).toBeNull();
  });
});
