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
import type { LookupOption } from "../../api/riskApi";
import PlatformPicker from "./PlatformPicker";
import { platformChoices } from "./templates";

// Integration Platform (7) has Ballerina (9) and Micro Integrator (10); Core
// Platform (4) has none.
const all: LookupOption[] = [
  { id: 4, name: "Core Platform", status: "ACTIVE" },
  { id: 7, name: "Integration Platform", status: "ACTIVE" },
  { id: 9, name: "Ballerina", parent_id: 7, status: "ACTIVE" },
  { id: 10, name: "Micro Integrator", parent_id: 7, status: "ACTIVE" },
];

function Harness({
  offered,
  initial,
  onChange,
}: {
  offered: number[];
  initial: number[];
  onChange: (v: number[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PlatformPicker
      choices={platformChoices(all, offered)}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const pill = (name: string) => screen.getByRole("button", { name });

describe("PlatformPicker", () => {
  it("shows a platform's sub-platforms only once the platform is picked", async () => {
    const user = userEvent.setup();
    render(<Harness offered={[]} initial={[]} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "Ballerina" })).toBeNull();

    await user.click(pill("Integration Platform"));
    expect(pill("Ballerina")).toBeInTheDocument();
    expect(pill("Micro Integrator")).toBeInTheDocument();
  });

  it("offers only what the register lists", () => {
    render(<Harness offered={[7, 9]} initial={[7]} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "Core Platform" })).toBeNull();
    expect(pill("Ballerina")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Micro Integrator" })).toBeNull();
  });

  it("puts the platform and its sub-platform in one value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness offered={[]} initial={[]} onChange={onChange} />);
    await user.click(pill("Integration Platform"));
    await user.click(pill("Ballerina"));
    expect(onChange).toHaveBeenLastCalledWith([7, 9]);
  });

  it("drops a platform's sub-platforms when the platform is unpicked, keeping the rest", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness offered={[]} initial={[4, 7, 9]} onChange={onChange} />);
    await user.click(pill("Integration Platform"));
    expect(onChange).toHaveBeenLastCalledWith([4]);
    expect(screen.queryByRole("button", { name: "Ballerina" })).toBeNull();
  });

  it("marks sub-platforms required only when the register lists some", () => {
    const { unmount } = render(<Harness offered={[7, 9]} initial={[7]} onChange={() => {}} />);
    expect(screen.queryByText(/Optional: leave empty/)).toBeNull();
    unmount();
    render(<Harness offered={[]} initial={[7]} onChange={() => {}} />);
    expect(screen.getByText(/Optional: leave empty/)).toBeInTheDocument();
  });

  it("picks the only platform a register offers and shows just its sub-platforms", () => {
    const onChange = vi.fn();
    render(<Harness offered={[7, 9, 10]} initial={[]} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Integration Platform" })).toBeNull();
    expect(onChange).toHaveBeenCalledWith([7]);
    expect(pill("Ballerina")).toBeInTheDocument();
    expect(pill("Micro Integrator")).toBeInTheDocument();
  });

  it("still asks for the platform when the register offers several", () => {
    render(<Harness offered={[4, 7, 9]} initial={[]} onChange={() => {}} />);
    expect(pill("Core Platform")).toBeInTheDocument();
    expect(pill("Integration Platform")).toBeInTheDocument();
  });
});
