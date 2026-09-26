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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { YearsBackSessionProvider, useYearsBackSession } from "./YearsBackSessionContext";

// The Years Back a reader set earlier, carried across Tables and Periods for as
// long as the tab is open. Unset means the Table defaults still apply.

function Probe({ set }: { set?: number | null }) {
  const { yearsBack, setYearsBack } = useYearsBackSession();
  return (
    <div>
      <span data-testid="years">{yearsBack === null ? "unset" : String(yearsBack)}</span>
      <button type="button" onClick={() => setYearsBack(set ?? null)}>
        set
      </button>
    </div>
  );
}

const renderProbe = (set?: number | null) =>
  render(
    <YearsBackSessionProvider>
      <Probe set={set} />
    </YearsBackSessionProvider>,
  );

const shown = () => screen.getByTestId("years").textContent;

describe("YearsBackSessionProvider", () => {
  it("is unset until the reader sets a Years Back", () => {
    renderProbe();
    expect(shown()).toBe("unset");
  });

  it("holds a Years Back the reader set", async () => {
    renderProbe(3);
    await userEvent.setup().click(screen.getByRole("button", { name: "set" }));
    expect(shown()).toBe("3");
  });

  it("goes back to unset, which is how the Table defaults return", async () => {
    const user = userEvent.setup();
    const { rerender } = renderProbe(3);
    await user.click(screen.getByRole("button", { name: "set" }));
    rerender(
      <YearsBackSessionProvider>
        <Probe set={null} />
      </YearsBackSessionProvider>,
    );
    await user.click(screen.getByRole("button", { name: "set" }));
    expect(shown()).toBe("unset");
  });

  it("ignores a value outside the 1–10 the control offers", async () => {
    // Nothing in the app sets one, but this is the value a Years Back is seeded
    // from, and a zero here would ask the backend for no columns at all.
    renderProbe(0);
    await userEvent.setup().click(screen.getByRole("button", { name: "set" }));
    expect(shown()).toBe("unset");
  });

  it("writes nothing to storage, which is what makes it die with the tab", async () => {
    // The source's is a Redux slice, and — unlike Scale, which sits beside this
    // and writes `one-wso2.scale` — nothing here outlives the tab. Asserted as
    // "no key appears", because a test that plants a key nothing reads would
    // pass however much this wrote.
    localStorage.clear();
    sessionStorage.clear();
    renderProbe(3);
    await userEvent.setup().click(screen.getByRole("button", { name: "set" }));
    expect(shown()).toBe("3");
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it("is forgotten when the tab is", () => {
    // A fresh provider is what a reload looks like from here, and the planted
    // key is the canary: persist under the obvious name later and this fails.
    localStorage.setItem("one-wso2.yearsBack", "3");
    sessionStorage.setItem("one-wso2.yearsBack", "3");
    renderProbe();
    expect(shown()).toBe("unset");
    localStorage.clear();
    sessionStorage.clear();
  });

  it("refuses to be read outside its provider", () => {
    // Defaulting quietly would seed one screen's bar from the session and the
    // next from the Table, with nothing on either saying which it used.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/YearsBackSessionProvider/);
    quiet.mockRestore();
  });
});
