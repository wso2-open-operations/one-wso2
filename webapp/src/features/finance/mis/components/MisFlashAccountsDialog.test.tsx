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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "@api/http";
import type { FlashAccountsQuery, FlashFinancialAccount } from "../api/misFlashTypes";

// Every test here opens dialogs and drives a form through `userEvent`, under
// the Oxygen theme; the suite's parallelism takes that past vitest's 5s default
// while it runs well under one second alone.
vi.setConfig({ testTimeout: 20_000 });

// The account view: the GL accounts behind one Flash figure, and the form that
// writes a forecast against one of them. Ticket 16.
//
// Spec §10.15 and §10.16 are asserted HERE, on what is on screen, through the
// real `useFlashAccounts` and `useUpdateFlashAccount` over a mocked transport —
// not over a mocked hook, which could only describe a screen in whatever state
// the mock was told to be in. The failure these tests exist to rule out is a
// value that looks saved and is not, and that is a property of the hooks and
// the screen together.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>(
    "@hooks/useAsgardeoSub",
  );
  return {
    ...actual,
    useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisFlashConfigured: () => true,
  misFlashServiceUrls: {
    incomeAccounts: "https://flash.example/income-accounts",
    costOfSalesAccounts: "https://flash.example/cost-of-sales-accounts",
  },
}));

/** What the server holds. A GET reads it; a PATCH it accepts writes it. */
const server = { accounts: [] as FlashFinancialAccount[], readFails: false };
/** What the next PATCH does: `null` accepts it, an error refuses it. */
const patchOutcome = { value: null as Error | null };
const authedGet = vi.fn(async () => {
  if (server.readFails) throw new HttpError("https://flash.example/income-accounts", 404, "");
  return server.accounts.map((account) => ({ ...account }));
});
const authedPatch = vi.fn(async (_url: string, _token: string, body: unknown) => {
  if (patchOutcome.value) throw patchOutcome.value;
  const { id, value, comment } = body as { id: number; value: number; comment: string | null };
  server.accounts = server.accounts.map((account) =>
    account.id === id ? { ...account, budgetedValue: value, comment } : account,
  );
  return null;
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedGet: () => authedGet(),
    authedPatch: (url: string, token: string, body: unknown) => authedPatch(url, token, body),
  };
});

const { default: MisFlashAccountsDialog } = await import("./MisFlashAccountsDialog");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

/** Recurring Revenue for IAM, in August — the month the server takes forecasts for. */
const AUGUST: FlashAccountsQuery = {
  book: "income",
  accountCategory: "Recurring Revenue",
  businessUnit: "IAM",
  month: "2026-08",
};
const FORECAST_MONTH = { year: 2026, month: 8 };

const SUBSCRIPTIONS: FlashFinancialAccount = {
  id: 41,
  accountName: "4010 Subscriptions",
  amount: 1000,
  budgetedValue: 1200,
  comment: "Renewal slipped",
  month: "2026-08",
};
const SUPPORT: FlashFinancialAccount = {
  id: 42,
  accountName: "4020 Support",
  amount: 250.5,
  budgetedValue: null,
  comment: null,
  month: "2026-08",
};

function show(query: FlashAccountsQuery | null = AUGUST) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationsProvider>
        <MisFlashAccountsDialog
          query={query}
          unitLabel="IAM"
          forecastMonth={FORECAST_MONTH}
          onClose={() => {}}
        />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// `hidden`, because the list is read with the form open over it too — and MUI
// marks the modal underneath `aria-hidden` while another is on top, though it
// is still on screen behind the form.
const accountsTable = () =>
  screen.findByRole("table", { name: /Accounts behind/, hidden: true });
/** The cells of one account's row, as text. */
async function rowOf(accountName: string) {
  const table = await accountsTable();
  const row = within(table)
    .getByRole("rowheader", { name: accountName, hidden: true })
    .closest("tr")!;
  return Array.from(row.querySelectorAll("th, td")).map((cell) => cell.textContent);
}
const editButton = (accountName: string) =>
  screen.findByRole("button", { name: `Edit ${accountName}` });
const form = () => screen.getByRole("dialog", { name: /^Update:/ });

beforeEach(() => {
  server.accounts = [SUBSCRIPTIONS, SUPPORT];
  server.readFails = false;
  patchOutcome.value = null;
  authedGet.mockClear();
  authedPatch.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the accounts behind a figure", () => {
  it("names the figure it was opened from", async () => {
    show();
    expect(
      await screen.findByText("Account View — Recurring Revenue of IAM for Aug 2026"),
    ).toBeInTheDocument();
  });

  it("lists each account with what the ledger says and what was forecast", async () => {
    show();
    expect(await rowOf("4010 Subscriptions")).toEqual([
      "4010 Subscriptions",
      "1,000.00",
      "1,200.00",
      "Renewal slipped",
      "",
    ]);
  });

  // The source formats a missing forecast as `$0.00` (`Number(null)`), which
  // reads as a forecast of nought. Spec §7.
  it("leaves a forecast nobody has written blank, not nought", async () => {
    show();
    const [, amount, forecast] = await rowOf("4020 Support");
    expect(amount).toBe("250.50");
    expect(forecast).toBe("");
  });

  // The form takes units, so the list beside it is in units too, whatever the
  // reader's Scale — a list in thousands beside an input in units invites a
  // forecast a thousand times off. CONTEXT.md, under Scale.
  it("says the amounts are in units", async () => {
    show();
    await accountsTable();
    expect(screen.getByText("All amounts in USD")).toBeInTheDocument();
  });

  it("says so when there are no accounts behind the figure", async () => {
    server.accounts = [];
    show();
    expect(await screen.findByText("No accounts behind this figure.")).toBeInTheDocument();
  });

  it("says so when the accounts cannot be read, with a way to try again", async () => {
    server.readFails = true;
    show();
    expect(await screen.findByText(/Couldn't load the accounts/)).toBeInTheDocument();
    server.readFails = false;
    await userEvent.click(screen.getByRole("button", { name: /Retry|Try again/ }));
    expect(await rowOf("4010 Subscriptions")).toContain("1,200.00");
  });
});

describe("which accounts can be edited", () => {
  it("offers Edit on every account for the month the server takes forecasts for", async () => {
    show();
    expect(await editButton("4010 Subscriptions")).toBeInTheDocument();
    expect(await editButton("4020 Support")).toBeInTheDocument();
  });

  // `AccountViewTable.js:53` hides the whole Edit column on any other month.
  it("offers no Edit on any other month", async () => {
    show({ ...AUGUST, month: "2026-07" });
    await accountsTable();
    expect(screen.queryByRole("button", { name: /^Edit / })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Edit" })).not.toBeInTheDocument();
  });

  // Spec §8.1. The 22nd is past the cutoff, and Edit is offered anyway: the
  // server decides, and the screen reports what it decided.
  it("still offers Edit after the 15th, because the cutoff is the server's to apply", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-22T10:00:00Z"));
    show();
    expect(await editButton("4010 Subscriptions")).toBeInTheDocument();
  });
});

describe("writing a forecast", () => {
  it("opens on the account's current forecast and comment", async () => {
    show();
    await userEvent.click(await editButton("4010 Subscriptions"));
    expect(within(form()).getByRole("spinbutton", { name: "Value" })).toHaveValue(1200);
    expect(within(form()).getByRole("textbox", { name: "Comment" })).toHaveValue("Renewal slipped");
  });

  // `ForecastValueInput.value` is a required decimal: a forecast can be
  // changed and never cleared, so an empty value cannot be sent.
  it("will not send a value that is not a number", async () => {
    show();
    await userEvent.click(await editButton("4010 Subscriptions"));
    await userEvent.clear(within(form()).getByRole("spinbutton", { name: "Value" }));
    expect(within(form()).getByRole("button", { name: "Update" })).toBeDisabled();
  });

  // What appears afterwards is the server's answer to a fresh read, which
  // this fake server derives from what it was sent.
  it("shows the saved forecast once the server has taken it", async () => {
    show();
    await userEvent.click(await editButton("4010 Subscriptions"));
    const value = within(form()).getByRole("spinbutton", { name: "Value" });
    await userEvent.clear(value);
    await userEvent.type(value, "1500.75");
    await userEvent.click(within(form()).getByRole("button", { name: "Update" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Update:/ })).toBeNull());
    expect(authedPatch).toHaveBeenCalledWith("https://flash.example/income-accounts", "token", {
      id: 41,
      value: 1500.75,
      comment: "Renewal slipped",
    });
    await waitFor(async () => expect((await rowOf("4010 Subscriptions"))[2]).toBe("1,500.75"));
    expect(await screen.findByText("Account updated.")).toBeInTheDocument();
  });
});

describe("when the server refuses the edit", () => {
  // The flash backend turns every failure into a bare 500 (`service.bal:139`),
  // the cutoff's included: the entity service's reason never reaches the
  // browser.
  const refuse = () => {
    patchOutcome.value = new HttpError("https://flash.example/income-accounts", 500, "");
  };

  async function attempt(typed: string) {
    show();
    await userEvent.click(await editButton("4010 Subscriptions"));
    const value = within(form()).getByRole("spinbutton", { name: "Value" });
    await userEvent.clear(value);
    await userEvent.type(value, typed);
    await userEvent.click(within(form()).getByRole("button", { name: "Update" }));
  }

  // Spec §10.15.
  it("says the change was refused and why it may have been, and leaves the saved value", async () => {
    refuse();
    await attempt("999");
    expect(
      await within(form()).findByText(
        "Not saved — the Flash backend refused the change (HTTP 500). It refuses every " +
          "edit after the monthly cutoff, and doesn't say which refusal this was.",
      ),
    ).toBeInTheDocument();
    expect((await rowOf("4010 Subscriptions"))[2]).toBe("1,200.00");
  });

  // The typed value stays where it was typed, so the reader can see what was
  // refused — in the form, which is visibly not the list.
  it("keeps the form open on what was typed", async () => {
    refuse();
    await attempt("999");
    await within(form()).findByText(/Not saved/);
    expect(within(form()).getByRole("spinbutton", { name: "Value" })).toHaveValue(999);
  });

  // Spec §10.16. After a refusal nothing on screen but the form's own input
  // holds the refused value, and once the form is gone nothing does — and the
  // list was never re-read, so it is not a fresh answer that happens to agree.
  it("leaves no trace of the refused value once the form is closed", async () => {
    refuse();
    await attempt("999");
    await within(form()).findByText(/Not saved/);
    await userEvent.click(within(form()).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Update:/ })).toBeNull());
    expect((await rowOf("4010 Subscriptions"))[2]).toBe("1,200.00");
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    expect(authedGet).toHaveBeenCalledTimes(1);
  });

  // A refusal that is not the flash backend's own — the gateway, a dead
  // session — is not a cutoff, and saying it might be would send the reader to
  // the wrong explanation.
  it("does not blame the cutoff for a refusal that came from somewhere else", async () => {
    patchOutcome.value = new HttpError(
      "https://flash.example/income-accounts",
      401,
      JSON.stringify({ message: "Invalid credentials" }),
    );
    await attempt("999");
    expect(
      await within(form()).findByText("Not saved — Invalid credentials"),
    ).toBeInTheDocument();
  });
});
