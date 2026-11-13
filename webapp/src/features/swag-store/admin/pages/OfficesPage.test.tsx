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
import { MemoryRouter } from "react-router";
import { adminOffice } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn(), authedPost: vi.fn(), authedPatch: vi.fn() }));

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "admin" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isSwagStoreBackendConfigured: () => true,
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedGet: http.authedGet,
  authedPost: http.authedPost,
  authedPatch: http.authedPatch,
}));

import { HttpError } from "@api/http";
import OfficesPage from "./OfficesPage";

const originalConfig = window.config;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/people-ops/swag-store/settings/offices"]}>
        <OfficesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  Object.values(http).forEach((f) => f.mockReset());
  http.authedGet.mockResolvedValue({ items: [adminOffice(), adminOffice({ id: "office-kandy", name: "Kandy", active: false, hrLocations: [] })] });
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the pickup offices page", () => {
  it("lists every office with its lead time, HR locations and whether it is open", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Pickup offices" })).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /Colombo.*Sri Lanka.*2 days.*Colombo.*Active/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Kandy.*Inactive/ })).toBeInTheDocument();
  });

  it("adds an office", async () => {
    http.authedPost.mockResolvedValue(adminOffice({ id: "office-galle", name: "Galle" }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Add office" }));
    const dialog = screen.getByRole("dialog", { name: "Add office" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Galle");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Address" }), "1 Fort Road");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Country" }), "Sri Lanka");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Collection point" }), "Front desk");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Hours" }), "Mon–Fri 9–5");
    await userEvent.clear(within(dialog).getByRole("spinbutton", { name: "Lead time (working days)" }));
    await userEvent.type(within(dialog).getByRole("spinbutton", { name: "Lead time (working days)" }), "3");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "HR locations" }), "Galle, Matara");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(http.authedPost).toHaveBeenCalledWith("/admin/pickup-offices", "token", {
      name: "Galle",
      address: "1 Fort Road",
      country: "Sri Lanka",
      collectionPoint: "Front desk",
      hours: "Mon–Fri 9–5",
      leadTimeDays: 3,
      hrLocations: ["Galle", "Matara"],
      active: true,
      sort: 0,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }, 15000);

  it("edits an office, sending the whole office back", async () => {
    http.authedPatch.mockResolvedValue(adminOffice({ leadTimeDays: 4 }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Edit Colombo" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Colombo" });
    const lead = within(dialog).getByRole("spinbutton", { name: "Lead time (working days)" });
    await userEvent.clear(lead);
    await userEvent.type(lead, "4");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(http.authedPatch).toHaveBeenCalledWith(
      "/admin/pickup-offices/office-colombo",
      "token",
      expect.objectContaining({ name: "Colombo", leadTimeDays: 4, hrLocations: ["Colombo"], active: true }),
    );
  });

  it("won't save without a name, and shows the backend's refusal", async () => {
    http.authedPost.mockRejectedValue(new HttpError("/admin/pickup-offices", 400, JSON.stringify({ message: "hours is required." })));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Add office" }));
    const dialog = screen.getByRole("dialog", { name: "Add office" });
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Galle");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("hours is required.")).toBeInTheDocument();
  });

  it("shows a failure with Retry, never as no offices", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/admin/pickup-offices", 503, JSON.stringify({ message: "Database is down." })));
    renderPage();
    expect(await screen.findByText(/Couldn't load the offices/)).toBeInTheDocument();
  });
});
