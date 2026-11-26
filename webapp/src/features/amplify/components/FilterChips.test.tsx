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
import { fireEvent, render, screen, within } from "@testing-library/react";
import FilterChips from "./FilterChips";

describe("FilterChips", () => {
  it("names the group, presses the selected chip and reports a pick", () => {
    const onChange = vi.fn();
    render(
      <FilterChips
        ariaLabel="Filter things"
        value="b"
        onChange={onChange}
        options={[
          { value: "a", label: "All", count: 3 },
          { value: "b", label: "Some" },
        ]}
      />,
    );
    const chips = within(screen.getByRole("group", { name: "Filter things" })).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["All 3", "Some"]);
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
    fireEvent.click(screen.getByRole("button", { name: "All 3" }));
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
