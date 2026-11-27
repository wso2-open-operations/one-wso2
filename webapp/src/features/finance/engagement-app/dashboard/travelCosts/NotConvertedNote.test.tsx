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

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NotConverted } from "../../api/engagementTypes";
import NotConvertedNote from "./NotConvertedNote";

const rows: NotConverted[] = [
  { source: "claim", currency: "LKR", amount: 280695888, lines: 1400 },
  { source: "invoice", currency: "AED", amount: 825, lines: 50 },
  { source: "claim", currency: "AED", amount: 10.5, lines: 4 },
];

describe("NotConvertedNote", () => {
  it("counts the lines, not the rows", () => {
    render(<NotConvertedNote rows={rows} />);
    expect(screen.getByText("1,454 amounts in 2 currencies have no exchange rate, so they are left out of the totals.")).toBeTruthy();
  });

  it("counts one per row when the backend sent no lines", () => {
    render(<NotConvertedNote rows={[{ source: "card", currency: "EUR", amount: 5 }]} />);
    expect(screen.getByText("1 amount in 1 currency has no exchange rate, so it is left out of the totals.")).toBeTruthy();
  });

  it("reports blank-currency amounts as missing currency, not as a currency", () => {
    render(<NotConvertedNote rows={[{ source: "card", currency: "", amount: 5, lines: 2 }]} />);
    expect(screen.getByText("2 amounts have no currency recorded, so they are left out of the totals.")).toBeTruthy();
  });

  it("keeps known currencies and blank currencies apart", () => {
    render(<NotConvertedNote rows={[{ source: "card", currency: "EUR", amount: 5, lines: 3 }, { source: "claim", currency: "", amount: 1 }]} />);
    expect(screen.getByText("3 amounts in 1 currency have no exchange rate, so they are left out of the totals. 1 amount has no currency recorded, so it is left out of the totals.")).toBeTruthy();
  });

  it("shows nothing when there is nothing to say", () => {
    const { container } = render(<NotConvertedNote rows={[]} />);
    expect(container.textContent).toBe("");
  });

  it("says rates are loading, and keeps View when there are rows", () => {
    render(<NotConvertedNote rows={rows} ratesPending />);
    expect(screen.getByText("Some exchange rates are still loading, so totals may be low. Refresh in a minute.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View" })).toBeTruthy();
  });

  it("says rates are loading with no View when there are no rows", () => {
    render(<NotConvertedNote rows={[]} ratesPending />);
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
  });

  it("opens a table sorted by source, then currency", () => {
    render(<NotConvertedNote rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Amounts Left Out of the Totals")).toBeTruthy();
    const body = within(dialog).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(body).toEqual(["AEDTravel InvoicesAED 825.0050", "AEDExpense ClaimsAED 10.504", "LKRExpense ClaimsLKR 280,695,8881,400"]);
  });
});
