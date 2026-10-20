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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CcTransaction } from "./ccTypes";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const jobDetails = {
  engagementCode: "ENG-1",
  engagementType: "T&M",
  customerName: "Acme",
  city: "Colombo",
  country: "Sri Lanka",
  globalPod: "APAC",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  productUnit: "Integration",
  businessUnit: "Platform",
  fundingSources: [
    { region: "APAC", subRegion: "South Asia", businessUnit: "Platform", productUnit: "Integration", percentage: 100 },
  ],
};

const state = { fail: false, noFunding: false, halfUnits: false };

vi.mock("./useCc", () => ({
  useCcMenus: () => ({
    expenseTypes: {
      data: {
        categories: ["Travel", "Software"],
        types: { Travel: ["Flights"], Software: ["Licence"] },
      },
      isLoading: false,
    },
    subRegions: { data: { subRegions: ["South Asia"] }, isLoading: false },
    units: {
      data: { productUnits: ["Integration", "Other"], businessUnits: ["Platform", "Corp"] },
      isLoading: false,
    },
    jobNumbers: { data: { jobNumbers: ["TRV-2026-01-0001"] }, isLoading: false },
  }),
  useCcJobNumberDetails: (jobNumber: string | undefined) => {
    if (!jobNumber) return { data: undefined, isLoading: false, isError: false };
    if (state.fail) return { data: undefined, isLoading: false, isError: true };
    const details = state.noFunding
      ? { ...jobDetails, fundingSources: [] }
      : state.halfUnits
        ? { ...jobDetails, businessUnit: "" }
        : jobDetails;
    return { data: details, isLoading: false, isError: false };
  },
}));

const { CcBulkEditDialog } = await import("./CcBulkEditDialog");

const row = (category: string | null, id: number): CcTransaction =>
  ({
    id,
    ccNumber: "1234",
    txnDate: "2026-08-01",
    txnDescription: "Flight",
    txnAmount: 100,
    expenseCategoryLabel: category,
    expenseTypeLabel: null,
    txnComment: null,
    subRegion: null,
    travelJobNumber: null,
    productUnit: null,
    businessUnit: null,
    status: "new",
  }) as unknown as CcTransaction;

const onApply = vi.fn<(rows: CcTransaction[]) => Promise<void>>(async () => undefined);

function show(txns: CcTransaction[]) {
  return render(
    <CcBulkEditDialog open txns={txns} onClose={vi.fn()} onApply={onApply} />,
  );
}

const jobNumberField = () => screen.queryByRole("combobox", { name: /Job Number/i });

/** Travel has to be chosen here for the field to exist at all. */
async function chooseTravel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: /Expense Category/i }));
  await user.click(await screen.findByRole("option", { name: "Travel" }));
}

beforeEach(() => {
  state.fail = false;
  state.noFunding = false;
  state.halfUnits = false;
  onApply.mockClear();
});

// Finance's requirement: the Job Number field appears only for Travel.
describe("the bulk edit dialog's Job Number field", () => {
  it("is offered when Travel is the category being applied", async () => {
    const user = userEvent.setup();
    show([row(null, 1)]);
    expect(jobNumberField()).not.toBeInTheDocument();

    await chooseTravel(user);

    expect(jobNumberField()).toBeInTheDocument();
  });

  it("is not offered when a non-Travel category is being applied", async () => {
    const user = userEvent.setup();
    show([row("Travel", 1)]);

    await user.click(screen.getByRole("combobox", { name: /Expense Category/i }));
    await user.click(await screen.findByRole("option", { name: "Software" }));

    expect(jobNumberField()).not.toBeInTheDocument();
  });

  // The dialog's own category decides, not the rows' — so Travel has to be
  // picked here even when every selected row already carries it.
  it("is not offered with no category chosen, whatever the rows already are", () => {
    show([row("Travel", 1), row("Travel", 2)]);
    expect(jobNumberField()).not.toBeInTheDocument();
  });

  it("is not offered with no category chosen when the selection is mixed", () => {
    show([row("Travel", 1), row("Software", 2)]);
    expect(jobNumberField()).not.toBeInTheDocument();
  });
});

describe("the bulk edit dialog refuses a job number it cannot trust", () => {
  const applyButton = () => screen.getByRole("button", { name: /Apply/i });

  it("rejects one that is not shaped like a job number", async () => {
    const user = userEvent.setup();
    show([row("Travel", 1)]);
    await chooseTravel(user);

    await user.type(jobNumberField()!, "ABC-123");
    await user.tab();

    expect(await screen.findByText(/format TRV-YYYY-MM-NNNN/i)).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  it("rejects one that no travel matches", async () => {
    state.fail = true;
    const user = userEvent.setup();
    show([row("Travel", 1)]);
    await chooseTravel(user);

    await user.type(jobNumberField()!, "TRV-2016-10-0042");
    await user.tab();

    expect(await screen.findByText(/Could not verify this job number/i)).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  it("rejects one with no funding sources to charge against", async () => {
    state.noFunding = true;
    const user = userEvent.setup();
    show([row("Travel", 1)]);
    await chooseTravel(user);

    await user.type(jobNumberField()!, "TRV-2026-01-0001");
    await user.tab();

    expect(
      await screen.findByText(/That job has no funding sources to charge against/i),
    ).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  // The list only holds the past year, so an older job has to be typed out.
  it("accepts one typed in full that is not in the list", async () => {
    const user = userEvent.setup();
    show([row("Travel", 1), row("Travel", 2)]);
    await chooseTravel(user);

    await user.type(jobNumberField()!, "TRV-2016-10-0042");
    await user.tab();
    await user.click(applyButton());

    expect(onApply).toHaveBeenCalledTimes(1);
    const rows = onApply.mock.calls[0][0];
    expect(rows.map((r) => r.travelJobNumber)).toEqual(["TRV-2016-10-0042", "TRV-2016-10-0042"]);
    // A travel row's units come from its job, not from a hand-picked unit.
    expect(rows.map((r) => r.productUnit)).toEqual(["Integration", "Integration"]);
    expect(rows.map((r) => r.businessUnit)).toEqual(["Platform", "Platform"]);
  });

  // The single-row panel saves a half-filled pair rather than keeping the
  // row's old units, and warns. Bulk writes the same pair, so one job cannot
  // save two ways depending on which screen was used.
  it("writes a job's units even when only one of the pair came back", async () => {
    state.halfUnits = true;
    const user = userEvent.setup();
    show([row("Travel", 1)]);
    await chooseTravel(user);

    await user.type(jobNumberField()!, "TRV-2026-01-0001");
    await user.tab();
    await user.click(screen.getByRole("button", { name: /Apply/i }));

    const rows = onApply.mock.calls[0][0];
    expect(rows[0].productUnit).toBe("Integration");
    expect(rows[0].businessUnit).toBe("");
  });
});
