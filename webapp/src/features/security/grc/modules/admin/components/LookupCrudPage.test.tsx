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

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lookup } from "../api/adminApi";
import LookupCrudPage from "./LookupCrudPage";

// The page talks to the backend only through the shim's fetch, so a fake of it
// stands in for the whole backend: it records every request and answers from an
// in-memory list, the way /api/v1/risks/{customers|products|...} would.
const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

let rows: Lookup[] = [];
let failNext: { status: number; message: string } | null = null;

const json = (status: number, body: unknown): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

function requestsTo(method: string): { url: string; body: Record<string, unknown> | null }[] {
  return authFetch.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") === method)
    .map(([url, init]) => ({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null }));
}

beforeEach(() => {
  authFetch.mockReset();
  failNext = null;
  authFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method !== "GET" && failNext) {
      const f = failNext;
      failNext = null;
      return json(f.status, { message: f.message });
    }
    if (method === "GET") return json(200, rows);
    if (method === "POST") {
      const body = JSON.parse(String(init?.body));
      const created: Lookup = { id: 99, name: body.name, code: body.code, status: "ACTIVE", in_use: false };
      rows = [...rows, created];
      return json(201, created);
    }
    if (method === "PUT") return json(200, rows[0]);
    return json(204, null);
  });
});

describe("LookupCrudPage (customers)", () => {
  const customers = (): Lookup[] => [
    { id: 1, name: "Bank One Sub", code: "BANKONESUB", status: "ACTIVE", in_use: true },
    { id: 2, name: "Acme Corp", code: "ACMECORP", status: "INACTIVE", in_use: false },
  ];
  const renderPage = () =>
    render(
      <LookupCrudPage
        path="customers"
        addLabel="Add Customer"
        itemLabel="customer"
        emptyLabel="No customers found."
        nameHint="hint"
        hasCode
      />,
    );

  it("lists every customer with its code, status and usage", async () => {
    rows = customers();
    renderPage();
    const used = (await screen.findByText("Bank One Sub")).closest("tr")!;
    expect(within(used).getByText("BANKONESUB")).toBeInTheDocument();
    expect(within(used).getByText("Active")).toBeInTheDocument();
    expect(within(used).getByText("Yes")).toBeInTheDocument();
    const unused = screen.getByText("Acme Corp").closest("tr")!;
    expect(within(unused).getByText("Inactive")).toBeInTheDocument();
    expect(requestsTo("GET")[0].url).toBe("http://backend.test/api/v1/risks/customers");
  });

  it("only lets an unused customer be deleted", async () => {
    rows = customers();
    renderPage();
    const used = (await screen.findByText("Bank One Sub")).closest("tr")!;
    expect(within(used).getByRole("button", { name: "Delete" })).toBeDisabled();
    const unused = screen.getByText("Acme Corp").closest("tr")!;
    expect(within(unused).getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("deletes an unused customer after confirmation", async () => {
    rows = customers();
    const user = userEvent.setup();
    renderPage();
    const unused = (await screen.findByText("Acme Corp")).closest("tr")!;
    await user.click(within(unused).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(requestsTo("DELETE")).toHaveLength(1));
    expect(requestsTo("DELETE")[0].url).toBe("http://backend.test/api/v1/risks/customers/2");
  });

  it("creates a customer with the name and code, upper-casing the code as typed", async () => {
    rows = [];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Add Customer/ }));
    await user.type(screen.getByLabelText("Name"), "  Globex  ");
    await user.type(screen.getByLabelText("Code *"), "globex1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("POST")).toHaveLength(1));
    expect(requestsTo("POST")[0].body).toEqual({ name: "Globex", code: "GLOBEX1" });
  });

  it("refuses a bad code before calling the backend", async () => {
    rows = [];
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Add Customer/ }));
    await user.type(screen.getByLabelText("Name"), "Globex");
    await user.type(screen.getByLabelText("Code *"), "BAD-1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/only capital letters/i)).toBeInTheDocument();
    expect(requestsTo("POST")).toHaveLength(0);
  });

  it("locks the code of a customer that risks already use, and sends only the name", async () => {
    rows = customers();
    const user = userEvent.setup();
    renderPage();
    const used = (await screen.findByText("Bank One Sub")).closest("tr")!;
    await user.click(within(used).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Code *")).toBeDisabled();
    expect(screen.getByText(/already part of issued risk codes/i)).toBeInTheDocument();
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Bank One Subsidiary");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("PUT")).toHaveLength(1));
    expect(requestsTo("PUT")[0].url).toBe("http://backend.test/api/v1/risks/customers/1");
    expect(requestsTo("PUT")[0].body).toEqual({ name: "Bank One Subsidiary", status: "ACTIVE" });
  });

  it("lets the code of an unused customer change, and sends it", async () => {
    rows = customers();
    const user = userEvent.setup();
    renderPage();
    const unused = (await screen.findByText("Acme Corp")).closest("tr")!;
    await user.click(within(unused).getByRole("button", { name: "Edit" }));
    const code = screen.getByLabelText("Code *");
    expect(code).toBeEnabled();
    await user.clear(code);
    await user.type(code, "ACME");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("PUT")).toHaveLength(1));
    expect(requestsTo("PUT")[0].body).toEqual({ name: "Acme Corp", status: "INACTIVE", code: "ACME" });
  });

  it("shows the backend's message when a save is refused", async () => {
    rows = customers();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Add Customer/ }));
    await user.type(screen.getByLabelText("Name"), "Acme Corp");
    await user.type(screen.getByLabelText("Code *"), "ACME2");
    failNext = { status: 409, message: "a customer with that name or code already exists" };
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("a customer with that name or code already exists")).toBeInTheDocument();
  });
});

describe("LookupCrudPage name length", () => {
  it("stops the name input at the column's 255 characters", async () => {
    rows = [];
    const user = userEvent.setup();
    render(
      <LookupCrudPage
        path="products"
        addLabel="Add Product"
        itemLabel="product"
        emptyLabel="No products found."
        nameHint="hint"
      />,
    );
    await user.click(await screen.findByRole("button", { name: /Add Product/ }));
    expect(screen.getByLabelText("Name")).toHaveAttribute("maxlength", "255");
  });
});

describe("LookupCrudPage (a lookup without a code)", () => {
  it("has no code column or field, and creates with the name alone", async () => {
    rows = [{ id: 1, name: "API Manager", status: "ACTIVE", in_use: false }];
    const user = userEvent.setup();
    render(
      <LookupCrudPage
        path="products"
        addLabel="Add Product"
        itemLabel="product"
        emptyLabel="No products found."
        nameHint="hint"
      />,
    );
    await screen.findByText("API Manager");
    expect(screen.queryByText("Code")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add Product/ }));
    expect(screen.queryByLabelText("Code *")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Identity Server");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("POST")).toHaveLength(1));
    expect(requestsTo("POST")[0].url).toBe("http://backend.test/api/v1/risks/products");
    expect(requestsTo("POST")[0].body).toEqual({ name: "Identity Server" });
  });

  it("shows the empty state", async () => {
    rows = [];
    render(
      <LookupCrudPage
        path="platforms"
        addLabel="Add Platform"
        itemLabel="platform"
        emptyLabel="No platforms found."
        nameHint="hint"
      />,
    );
    expect(await screen.findByText("No platforms found.")).toBeInTheDocument();
  });
});

describe("LookupCrudPage (platforms with sub-platforms)", () => {
  // Integration Platform (1) has Ballerina (3) under it; Core Platform (2) has none.
  const platforms = (): Lookup[] => [
    { id: 3, name: "Ballerina", parent_id: 1, status: "ACTIVE", in_use: false },
    { id: 2, name: "Core Platform", status: "ACTIVE", in_use: false },
    { id: 1, name: "Integration Platform", status: "ACTIVE", in_use: false },
  ];
  const renderPage = () =>
    render(
      <LookupCrudPage
        path="platforms"
        addLabel="Add Platform"
        itemLabel="platform"
        emptyLabel="No platforms found."
        nameHint="hint"
        hasParent
      />,
    );

  it("lists a sub-platform right under its platform", async () => {
    rows = platforms();
    renderPage();
    await screen.findByText("Integration Platform");
    const names = screen.getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    const order = ["Core Platform", "Integration Platform", "Ballerina"].map((n) => names.findIndex((t) => t.includes(n)));
    expect(order).toEqual([0, 1, 2]);
    expect(screen.getByText(/↳/)).toBeInTheDocument();
  });

  it("won't delete a platform that still has sub-platforms", async () => {
    rows = platforms();
    renderPage();
    const parent = (await screen.findByText("Integration Platform")).closest("tr")!;
    expect(within(parent).getByRole("button", { name: "Delete" })).toBeDisabled();
    const childless = screen.getByText("Core Platform").closest("tr")!;
    expect(within(childless).getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("adds a sub-platform under the chosen platform", async () => {
    rows = platforms();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Integration Platform");
    await user.click(screen.getByRole("button", { name: /Add Platform/ }));
    await user.type(await screen.findByLabelText("Name"), "Micro Integrator");
    await user.click(screen.getByRole("combobox", { name: "Parent platform" }));
    const options = within(await screen.findByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    // Only top-level platforms can be a parent: Ballerina is not offered.
    expect(options).toEqual(["None (top-level platform)", "Core Platform", "Integration Platform"]);
    await user.click(screen.getByRole("option", { name: "Integration Platform" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("POST")).toHaveLength(1));
    expect(requestsTo("POST")[0].body).toEqual({ name: "Micro Integrator", parent_id: 1 });
  });

  it("adds a top-level platform without a parent_id", async () => {
    rows = platforms();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Integration Platform");
    await user.click(screen.getByRole("button", { name: /Add Platform/ }));
    await user.type(await screen.findByLabelText("Name"), "Analytics Platform");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("POST")).toHaveLength(1));
    expect(requestsTo("POST")[0].body).toEqual({ name: "Analytics Platform" });
  });

  it("shows the parent of an existing sub-platform but won't let it move", async () => {
    rows = platforms();
    const user = userEvent.setup();
    renderPage();
    const sub = (await screen.findByText(/Ballerina/)).closest("tr")!;
    await user.click(within(sub).getByRole("button", { name: "Edit" }));
    expect(await screen.findByText(/A sub-platform of Integration Platform/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Parent platform" })).toHaveAttribute("aria-disabled", "true");
  });
});
