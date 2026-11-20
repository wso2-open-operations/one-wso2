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
import { fireEvent, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  value: { ready: true, groups: [] as string[], error: undefined as string | undefined, retry: () => {} },
}));
vi.mock("@hooks/useAsgardeoGroups", () => ({ useAsgardeoGroups: () => state.value }));

import GroupsCard from "./GroupsCard";

function reveal() {
  render(<GroupsCard />);
  fireEvent.click(screen.getByRole("button", { name: "Show groups" }));
}

beforeEach(() => {
  state.value = { ready: true, groups: ["test-team", "admin-group"], error: undefined, retry: () => {} };
});

describe("GroupsCard", () => {
  it("hides the group names until revealed", () => {
    render(<GroupsCard />);
    expect(screen.queryByText("admin-group")).not.toBeInTheDocument();
  });

  it("shows each group as a chip, sorted", () => {
    reveal();
    const chips = screen.getAllByText(/-(team|group)$/).map((el) => el.textContent);
    expect(chips).toEqual(["admin-group", "test-team"]);
  });

  it("says so when the user has no groups", () => {
    state.value = { ...state.value, groups: [] };
    reveal();
    expect(screen.getByText("You aren't in any groups.")).toBeInTheDocument();
  });

  it("shows the decode error with a retry", () => {
    state.value = { ...state.value, groups: [], error: "Couldn't read your group memberships." };
    reveal();
    expect(screen.getByText("Couldn't read your group memberships.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
