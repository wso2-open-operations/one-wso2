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
import WideTableNotice from "./WideTableNotice";
import { writeDismissed } from "./wideTableNoticeStorage";

// The narrow-viewport answer for wide tables — spec §11.8, ticket 08.
//
// The decision it records: the notice appears, and the table STILL RENDERS and
// still scrolls. This is a sentence above a table, not a replacement for one.
//
// It compares the viewport against the table's OWN width, which `tableMinWidth`
// COMPUTES from the column model rather than measuring off the DOM — so these
// are exact rather than approximate, and jsdom models them perfectly. The
// widths below are the real ones: 380px is a BU Summary at `?years=1`, 1,288px
// the Subscription Build at its default Years Back, 8,520px Software/Cloud
// Customers at its narrowest breakdown.
const BU_SUMMARY_AT_ONE_YEAR = 380;
const SUBSCRIPTION_BUILD = 1288;
const CUSTOMERS_TABLE = 8520;

/** The live region is always mounted, so presence is asked of the TEXT. */
const notice = () => screen.queryByText(/wider than your screen/i);

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  act(() => void window.dispatchEvent(new Event("resize")));
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
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
  // laptop is comfortably past 1,024 and nowhere near this table's 8,520px.
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
    setViewportWidth(1440);
    expect(notice()).not.toBeInTheDocument();
  });

  // The table's own width changes under the reader — adding a Period widens it
  // — so the comparison has to follow the prop, not just the viewport.
  it("appears when the table grows past a viewport that has not moved", () => {
    setViewportWidth(1440);
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

  // Spec §10.22f. A wide viewport takes the notice away by itself, and that must
  // not count as the reader taking their dismissal back. Someone who widens the
  // window for a moment and narrows it again has not forgotten that the table
  // scrolls. Asked of the SAME mounted notice, because a remount re-reads storage
  // and would hide a dismissal that only lived in state being thrown away.
  it("keeps it dismissed after the viewport has been wide again", async () => {
    showNarrow();
    await userEvent.setup().click(screen.getByRole("button", { name: /dismiss/i }));

    setViewportWidth(1440);
    setViewportWidth(400);
    expect(notice()).not.toBeInTheDocument();
  });

  // Spec §10.22g. Remembered once per READER, not once per table: what they have
  // understood is "wide tables here scroll", which is not a fact about the
  // Subscription Build. Switching to Software/Cloud Customers mounts another
  // table, far wider, and it must not ask again. A different width is the only
  // thing that tells two tables apart at this component's interface, so it is
  // what a per-table memory would have to key on.
  it("keeps it dismissed on a second, different table", async () => {
    const first = showNarrow();
    await userEvent.setup().click(screen.getByRole("button", { name: /dismiss/i }));
    first.unmount();

    render(<WideTableNotice tableMinWidth={CUSTOMERS_TABLE} />);
    expect(notice()).not.toBeInTheDocument();
  });
});

// `localStorage` throws under private browsing and blocked site data, and this
// repo's other stored preference guards every access for the same reason. A
// notice is the last thing that should take a screen down.
describe("when storage is unavailable", () => {
  // `localStorage.setItem` is `Storage.prototype.setItem` in this repo's jsdom,
  // so the spy has to be on the prototype. Spying `window.localStorage` itself
  // does not sit on the global the module calls, and the guard would look fine
  // while storage still wrote. `toHaveBeenCalled` is what makes a spy that
  // missed the path fail, rather than a `try/catch` that never ran.
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
    expect(Storage.prototype.setItem).toHaveBeenCalled();
  });

  it("reports that it was remembered when storage works", () => {
    expect(writeDismissed()).toBe(true);
  });
});
