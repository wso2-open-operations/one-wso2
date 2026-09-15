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
import { fireEvent, render, screen } from "@testing-library/react";
import ParDateField from "./ParDateField";

// A native date input's min/max only constrain its calendar widget — typing
// a value directly bypasses them, and neither ParF2fTab nor
// ParScheduleF2fDialog's backend re-validates the range. ParDateField is the
// one shared place that has to reject it.
describe("ParDateField", () => {
  it("rejects a typed date before min", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} min="2026-01-10" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-01" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects a typed date after max", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} max="2026-01-10" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-20" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a date within bounds", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} min="2026-01-01" max="2026-01-31" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-15" } });
    expect(onChange).toHaveBeenCalledWith("2026-01-15");
  });

  it("accepts clearing the field even with bounds set", () => {
    const onChange = vi.fn();
    render(<ParDateField value="2026-01-15" onChange={onChange} min="2026-01-01" max="2026-01-31" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });
});
