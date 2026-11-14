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
import QuoteVersionsPage from "./QuoteVersionsPage";

const setting = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const save = {
  mutate: vi.fn((_n: number, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
  reset: vi.fn(),
  isPending: false,
  error: null as unknown,
};

// Mocked so the page is tested without Asgardeo, the network or window.config.
vi.mock("@features/sales/cado2/admin/quote-versions/api/useQuoteVersions", () => ({
  useQuoteVersions: () => setting,
  useSaveQuoteVersions: () => save,
}));

beforeEach(() => {
  save.mutate.mockClear();
});

describe("QuoteVersionsPage (D174)", () => {
  it("saves a new limit, 2 to 99, and says who changed it last", async () => {
    Object.assign(setting, {
      isPending: false,
      data: { maxVersions: 10, updatedByEmail: "admin@wso2.com", updatedAt: "2026-11-14T10:00:00Z" },
    });
    render(<QuoteVersionsPage />);
    expect(screen.getByText("Last changed 14 Nov 2026 · admin@wso2.com")).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "Most versions per quote" });
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.clear(field);
    await user.type(field, "1");
    expect(screen.getByText("Enter a whole number from 2 to 99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.clear(field);
    await user.type(field, "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(save.mutate).toHaveBeenCalledWith(5, expect.anything());
  });
});
