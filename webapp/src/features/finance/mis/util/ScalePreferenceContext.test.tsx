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
import userEvent from "@testing-library/user-event";
import { MIS_SCALES } from "./misViewVocabulary";
import { ScalePreferenceProvider, useScalePreference } from "./ScalePreferenceContext";

// Scale is a cross-page preference (spec §4): a reader who works in thousands
// works in thousands on the next MIS screen too, and after a reload.

const STORAGE_KEY = "one-wso2.scale";

beforeEach(() => {
  localStorage.clear();
});

function Probe() {
  const { preference, setPreference } = useScalePreference();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <button type="button" onClick={() => setPreference(MIS_SCALES.THOUSANDS)}>
        show thousands
      </button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <ScalePreferenceProvider>
      <Probe />
    </ScalePreferenceProvider>,
  );

describe("ScalePreferenceProvider", () => {
  it("starts in units when the reader has never chosen", () => {
    renderProbe();
    expect(screen.getByTestId("preference")).toHaveTextContent(MIS_SCALES.UNITS);
  });

  it("restores the Scale the reader last chose", () => {
    localStorage.setItem(STORAGE_KEY, MIS_SCALES.THOUSANDS);
    renderProbe();
    expect(screen.getByTestId("preference")).toHaveTextContent(MIS_SCALES.THOUSANDS);
  });

  it("applies and persists a new choice", async () => {
    renderProbe();
    await userEvent.setup().click(screen.getByRole("button", { name: "show thousands" }));
    expect(screen.getByTestId("preference")).toHaveTextContent(MIS_SCALES.THOUSANDS);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(MIS_SCALES.THOUSANDS);
  });

  it("ignores a stored value that is not a Scale", () => {
    // localStorage is reader-editable, and `k` is what the URL calls thousands
    // — near enough to be typed in by hand, and not what is stored here.
    localStorage.setItem(STORAGE_KEY, "k");
    renderProbe();
    expect(screen.getByTestId("preference")).toHaveTextContent(MIS_SCALES.UNITS);
  });

  it("still works when the browser refuses storage", async () => {
    // Private browsing and blocked site data both throw on access. Losing the
    // preference across a reload is acceptable; failing to render a revenue
    // report is not.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    renderProbe();
    expect(screen.getByTestId("preference")).toHaveTextContent(MIS_SCALES.UNITS);

    await userEvent.setup().click(screen.getByRole("button", { name: "show thousands" }));
    expect(screen.getByTestId("preference")).toHaveTextContent(MIS_SCALES.THOUSANDS);

    vi.restoreAllMocks();
  });

  it("refuses to be read outside its provider", () => {
    // A screen that read a default here instead would show units while the
    // reader's control said thousands, and nothing would say why.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ScalePreferenceProvider/);
    quiet.mockRestore();
  });
});
