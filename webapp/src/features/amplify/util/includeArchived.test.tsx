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

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { IncludeArchivedToggle } from "../components/DashboardParts";
import { withIncludeArchived } from "../api/useAmplifyDashboards";
import { INCLUDE_ARCHIVED_KEY, readIncludeArchived, useIncludeArchived, writeIncludeArchived } from "./includeArchived";

afterEach(() => {
  vi.restoreAllMocks();
  try {
    window.localStorage.removeItem(INCLUDE_ARCHIVED_KEY);
  } catch {
    // nothing saved
  }
});

describe("include archived preference", () => {
  it("is unticked until the viewer ticks it, and remembers the choice", () => {
    expect(readIncludeArchived()).toBe(false);
    const { result } = renderHook(() => useIncludeArchived());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(INCLUDE_ARCHIVED_KEY)).toBe("true");
    expect(renderHook(() => useIncludeArchived()).result.current[0]).toBe(true);
  });

  it("works without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readIncludeArchived()).toBe(false);
    expect(() => writeIncludeArchived(true)).not.toThrow();
    const { result } = renderHook(() => useIncludeArchived());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});

describe("withIncludeArchived", () => {
  it("adds the parameter only when archived posts count", () => {
    expect(withIncludeArchived("https://api/dashboards/glance", false)).toBe("https://api/dashboards/glance");
    expect(withIncludeArchived("https://api/dashboards/glance", true)).toBe("https://api/dashboards/glance?includeArchived=true");
    expect(withIncludeArchived("https://api/x?days=30", true)).toBe("https://api/x?days=30&includeArchived=true");
  });
});

describe("IncludeArchivedToggle", () => {
  it("is a labelled checkbox that reports the new value", () => {
    const onChange = vi.fn();
    render(<IncludeArchivedToggle checked={false} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Include archived posts" });
    expect((box as HTMLInputElement).checked).toBe(false);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
