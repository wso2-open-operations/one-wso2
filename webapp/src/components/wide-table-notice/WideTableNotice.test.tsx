/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WideTableNotice, { writeDismissed } from "./WideTableNotice";

// The narrow-viewport answer for wide tables — spec §11.8, ticket 08.
//
// The decision it records: the notice appears, and the table STILL RENDERS and
// still scrolls. This is a sentence above a table, not a replacement for one.
//
// It compares the viewport against the table's OWN width, which `tableMinWidth`
// COMPUTES from the column model rather than measuring off the DOM — so these
// are exact rather than approximate, and jsdom models them perfectly. The
// widths below are the real ones: 380px is a BU Summary at `?years=1`, 1,138px
// the Subscription Build at its default Years Back, 8,170px Software/Cloud
// Customers at its narrowest breakdown.
const BU_SUMMARY_AT_ONE_YEAR = 380;
const SUBSCRIPTION_BUILD = 1138;
const CUSTOMERS_TABLE = 8170;

/** The live region is always mounted, so presence is asked of the TEXT. */
const notice = () => screen.queryByText(/wider than your screen/i);

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  act(() => void window.dispatchEvent(new Event("resize")));
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
});

// The live region has to exist BEFORE it has anything to say — a region created
// at the moment its text appears is announced unreliably or not at all, which
// `MisFilterBar` states verbatim and this repo follows in three other places.
// It matters here in particular, because the notice can arrive on a resize.
describe("the live region", () => {
  it("is mounted even when there is nothing to say", () => {
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(notice()).not.toBeInTheDocument();
  });
});

describe("when the viewport fits the table", () => {
  it("says nothing", () => {
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).not.toBeInTheDocument();
  });

  it("says nothing exactly at the width the table needs", () => {
    setViewportWidth(SUBSCRIPTION_BUILD);
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).not.toBeInTheDocument();
  });

  // The case a fixed 1,024px threshold got WRONG. A BU Summary at `?years=1` is
  // 380px and fits a phone; the old version told the reader it did not.
  it("says nothing about a narrow table on a narrow screen", () => {
    setViewportWidth(400);
    render(<WideTableNotice tableMinWidth={BU_SUMMARY_AT_ONE_YEAR} />);
    expect(notice()).not.toBeInTheDocument();
  });
});

describe("when the table is wider than the viewport", () => {
  it("says so, and says what to do about it", () => {
    setViewportWidth(400);
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/scroll/i);
  });

  // The other case a fixed threshold got wrong, in the opposite direction: a
  // laptop is comfortably past 1,024 and nowhere near this table's 8,170px.
  it("says so on a wide screen when the table is wider still", () => {
    setViewportWidth(1280);
    render(<WideTableNotice tableMinWidth={CUSTOMERS_TABLE} />);
    expect(notice()).toBeInTheDocument();
  });

  // 768px is one of the three widths ticket 08 names.
  it("says so at a tablet width", () => {
    setViewportWidth(768);
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).toBeInTheDocument();
  });

  it("appears when the viewport is resized down to it", () => {
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).not.toBeInTheDocument();
    setViewportWidth(600);
    expect(notice()).toBeInTheDocument();
  });

  it("goes away again when there is room", () => {
    setViewportWidth(600);
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).toBeInTheDocument();
    setViewportWidth(1280);
    expect(notice()).not.toBeInTheDocument();
  });

  // The table's own width changes under the reader — adding a Period widens it
  // — so the comparison has to follow the prop, not just the viewport.
  it("appears when the table grows past a viewport that has not moved", () => {
    setViewportWidth(1280);
    const view = render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).not.toBeInTheDocument();
    view.rerender(<WideTableNotice tableMinWidth={CUSTOMERS_TABLE} />);
    expect(notice()).toBeInTheDocument();
  });
});

describe("dismissing it", () => {
  const showNarrow = () => {
    setViewportWidth(400);
    return render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
  };

  it("takes it off the screen", async () => {
    showNarrow();
    await userEvent.setup().click(screen.getByRole("button", { name: /dismiss/i }));
    expect(notice()).not.toBeInTheDocument();
  });

  // The ticket's own requirement: dismissed STAYS dismissed. A notice that came
  // back on every navigation would be worse than none.
  it("keeps it dismissed across a remount", async () => {
    const view = showNarrow();
    await userEvent.setup().click(screen.getByRole("button", { name: /dismiss/i }));
    view.unmount();

    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).not.toBeInTheDocument();
  });
});

// `localStorage` throws under private browsing and blocked site data, and this
// repo's other stored preference guards every access for the same reason. A
// notice is the last thing that should take a screen down.
describe("when storage is unavailable", () => {
  const blockStorage = () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
  };

  it("still shows, and still dismisses for this visit", async () => {
    blockStorage();
    setViewportWidth(400);
    render(<WideTableNotice tableMinWidth={SUBSCRIPTION_BUILD} />);
    expect(notice()).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: /dismiss/i }));
    expect(notice()).not.toBeInTheDocument();
  });

  // Asserted on the RETURN rather than inferred from the screen. Deleting the
  // `try/catch` in `writeDismissed` used to leave every assertion above
  // passing — the run only went red because Vitest happened to surface the
  // escaping error, which an error boundary would have swallowed.
  it("reports that the dismissal was not remembered", () => {
    blockStorage();
    expect(writeDismissed()).toBe(false);
  });

  it("reports that it was remembered when storage works", () => {
    expect(writeDismissed()).toBe(true);
  });
});
