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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScopeSwitch from "./ScopeSwitch";

const OPTIONS = [
  { value: "mine", label: "Mine" },
  { value: "all", label: "All" },
] as const;

describe("ScopeSwitch", () => {
  it("is a named group of pressed-or-not buttons, and reports a new choice once", async () => {
    const onChange = vi.fn();
    render(<ScopeSwitch value="all" options={OPTIONS} onChange={onChange} label="Whose opportunities to show" />);
    const group = within(screen.getByRole("group", { name: "Whose opportunities to show" }));
    expect(group.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(group.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(group.getByRole("button", { name: "Mine" }));
    expect(onChange).toHaveBeenCalledWith("mine");
    // The one already chosen stays chosen: no change reported.
    await userEvent.click(group.getByRole("button", { name: "All" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("greys out as one while the list cannot be asked", () => {
    render(<ScopeSwitch value="all" options={OPTIONS} onChange={() => {}} label="Which meetings to show" disabled />);
    for (const name of ["Mine", "All"]) expect(screen.getByRole("button", { name })).toBeDisabled();
  });
});
