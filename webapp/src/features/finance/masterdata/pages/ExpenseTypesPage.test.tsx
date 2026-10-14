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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Every filter object the page has asked the backend for, in order. */
const asked: unknown[] = [];

vi.mock("../useMasterData", () => ({
  isFinanceMasterDataBackendConfigured: () => true,
  useExpenseTypeAutoComplete: () => ({ data: undefined, isLoading: false, isError: false }),
  useExpenseTypes: (filters: unknown) => {
    asked.push(filters);
    return {
      data: [],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
}));

const { default: ExpenseTypesPage } = await import("./ExpenseTypesPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <ExpenseTypesPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

// The bar's own Apply button, not a field label: with the table always on
// screen now, "Expense Category" names a GRID COLUMN as well as a filter, so
// matching on it found the collapsed bar's twin in the header row.
const filterBar = () => screen.queryByRole("button", { name: /apply filters/i });

// The catalogue is on screen from the first render, so the bar is there for
// the person who wants to narrow it rather than a gate on the way in.
// Collapsed keeps the rows the thing you see first — "Show Filters" is a
// click the reader makes on purpose.
describe("Expense Types' filter bar", () => {
  beforeEach(() => {
    asked.length = 0;
  });

  it("starts collapsed, behind a Show Filters toggle", () => {
    show();

    expect(screen.getByRole("button", { name: /show filters/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hide filters/i })).not.toBeInTheDocument();
  });

  it("expands only once that toggle is clicked", async () => {
    const user = userEvent.setup();
    show();

    expect(filterBar()).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show filters/i }));

    expect(screen.getByRole("button", { name: /hide filters/i })).toBeInTheDocument();
    expect(filterBar()).toBeInTheDocument();
  });

  it("collapses again on a second click", async () => {
    const user = userEvent.setup();
    show();

    const toggle = screen.getByRole("button", { name: /show filters/i });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: /hide filters/i }));

    expect(screen.getByRole("button", { name: /show filters/i })).toBeInTheDocument();
  });

  // Asking someone to pick a filter before they can see what there is to
  // filter BY had it backwards: the whole catalogue is the starting point,
  // and an empty filter is the question that asks for it.
  it("asks for the whole catalogue on first load, with no filter applied", () => {
    show();

    expect(asked[0]).toEqual({});
    expect(screen.queryByText(/please select filters/i)).not.toBeInTheDocument();
    // The table itself is on screen, not a stand-in for one.
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("goes back to the whole catalogue when the filters are cleared", async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole("button", { name: /show filters/i }));
    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    // Not merely the bar's own fields: what the table is showing goes back to
    // everything too, or it would stay narrowed by something no longer
    // readable anywhere on screen.
    expect(asked.at(-1)).toEqual({});
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
