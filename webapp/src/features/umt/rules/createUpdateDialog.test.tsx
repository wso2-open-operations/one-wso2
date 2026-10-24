// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// The Create Update dialog's Proactive tab: a proactive update is never a
// hotfix, so switching to it clears a hotfix chosen on the other tab, along
// with the dates that hotfix freed from Thursdays.

import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));
vi.mock("../api/useUmtMeta", () => ({
  useUmtMeta: () => ({ data: { products: {} }, isPending: false, isError: false, isFetching: false, error: null }),
}));
vi.mock("../api/useUmtCreateUpdate", () => ({
  useUmtCheckDuplicateUpdatesByCaseId: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUmtCreateUpdate: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const { default: UmtCreateUpdateDialog } = await import("../components/UmtCreateUpdateDialog");

function renderDialog() {
  render(
    <MemoryRouter>
      <UmtCreateUpdateDialog open onClose={() => {}} />
    </MemoryRouter>,
  );
}

const hotfixSwitch = () => screen.getByLabelText("Hotfix") as HTMLInputElement;
// The picker's field is a group of date sections beside a hidden input that
// holds the whole date as text, which is what is read and written here.
const bestCaseDate = () =>
  screen.getAllByLabelText(/Best Case Estimate/).find((element) => element.tagName === "INPUT") as HTMLInputElement;

// The date field's text, a day later. The fields read and write MM/DD/YYYY.
function dayAfter(text: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) throw new Error(`Unexpected date field text: ${text}`);
  const next = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]) + 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(next.getMonth() + 1)}/${pad(next.getDate())}/${next.getFullYear()}`;
}

describe("switching the Create Update dialog to the Proactive tab", () => {
  it("clears a hotfix chosen on the other tab, and puts the dates back to the next Thursday", async () => {
    renderDialog();
    const nextThursday = bestCaseDate().value;
    await userEvent.click(hotfixSwitch());
    expect(hotfixSwitch()).toBeChecked();
    // A hotfix may use any day, so the date can be moved off Thursday.
    fireEvent.change(bestCaseDate(), { target: { value: dayAfter(nextThursday) } });
    expect(bestCaseDate().value).toBe(dayAfter(nextThursday));

    await userEvent.click(screen.getByRole("tab", { name: "Proactive" }));

    expect(hotfixSwitch()).not.toBeChecked();
    expect(hotfixSwitch()).toBeDisabled();
    expect(bestCaseDate().value).toBe(nextThursday);
    expect(screen.queryByText(/must be a Thursday/)).not.toBeInTheDocument();
  });

  it("leaves the dates alone when no hotfix was chosen", async () => {
    renderDialog();
    const nextThursday = bestCaseDate().value;
    const weekLater = dayAfter(dayAfter(dayAfter(dayAfter(dayAfter(dayAfter(dayAfter(nextThursday)))))));
    fireEvent.change(bestCaseDate(), { target: { value: weekLater } });
    expect(bestCaseDate().value).toBe(weekLater);

    await userEvent.click(screen.getByRole("tab", { name: "Proactive" }));

    expect(hotfixSwitch()).not.toBeChecked();
    expect(bestCaseDate().value).toBe(weekLater);
  });
});
