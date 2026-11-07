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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Lookup } from "../api/adminApi";
import PlatformChecklist from "./PlatformChecklist";

// Integration Platform (7) has the sub-platforms Ballerina (9) and Micro
// Integrator (10); Core Platform (4) has none; Analytics (3) is inactive.
const platforms: Lookup[] = [
  { id: 3, name: "Analytics Platform", status: "INACTIVE", in_use: false },
  { id: 4, name: "Core Platform", status: "ACTIVE", in_use: false },
  { id: 7, name: "Integration Platform", status: "ACTIVE", in_use: false },
  { id: 9, name: "Ballerina", parent_id: 7, status: "ACTIVE", in_use: false },
  { id: 10, name: "Micro Integrator", parent_id: 7, status: "ACTIVE", in_use: false },
];

function Harness({ initial, onChange }: { initial: number[]; onChange: (v: number[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PlatformChecklist
      platforms={platforms}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("PlatformChecklist", () => {
  it("shows a platform's sub-platforms only once the platform is ticked", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} onChange={() => {}} />);
    expect(screen.queryByRole("checkbox", { name: "Ballerina" })).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Integration Platform" }));
    expect(screen.getByRole("checkbox", { name: "Ballerina" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Micro Integrator" })).toBeTruthy();
  });

  it("unticking a platform unticks its sub-platforms", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={[4, 7, 9]} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Integration Platform" }));
    expect(onChange).toHaveBeenLastCalledWith([4]);
  });

  it("offers an inactive platform only while it is already ticked", () => {
    const { unmount } = render(<Harness initial={[]} onChange={() => {}} />);
    expect(screen.queryByRole("checkbox", { name: /Analytics Platform/ })).toBeNull();
    unmount();

    render(<Harness initial={[3]} onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Analytics Platform (inactive)" })).toBeTruthy();
  });
});
