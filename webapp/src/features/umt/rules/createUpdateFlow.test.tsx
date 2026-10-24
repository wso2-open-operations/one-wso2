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

// What the Create Update dialog does between Create and the update existing:
// an update at a product's base level has to be acknowledged first, and a new
// hotfix is given its product branch straight away.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UmtUpdateSummary } from "../api/umtUpdates";

const state = vi.hoisted(() => ({
  duplicates: [] as unknown[],
  created: [] as unknown[],
  createUpdate: vi.fn<(request: unknown) => Promise<unknown>>(),
  requestBranch: vi.fn<(variables: unknown) => Promise<void>>(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: state.showSuccess, showError: vi.fn(), showWarning: state.showWarning }),
}));

const product = (id: number, name: string, version: string, latestVersion: string, publicRepoUrl: string) => ({
  id,
  name,
  version,
  latestVersion,
  isLatest: true,
  leadMail: "",
  edMail: "",
  supportRepoUrl: "",
  publicRepoUrl,
});

vi.mock("../api/useUmtMeta", () => ({
  useUmtMeta: () => ({
    data: {
      products: {
        // Offered at its base level.
        wso2am: [product(7, "wso2am", "4.2.0.0.full", "4.2.0.0.full", "https://github.com/wso2/product-apim")],
        // Offered at a later level.
        wso2is: [product(8, "wso2is", "7.0.0.0.full", "7.0.0.3.full", "https://github.com/wso2/product-is")],
        // Offered at a later level, with no public repository known.
        wso2mi: [product(9, "wso2mi", "4.3.0.0.full", "4.3.0.2.full", "")],
      },
    },
    isPending: false,
    isError: false,
    isFetching: false,
    error: null,
  }),
}));
vi.mock("../api/useUmtCreateUpdate", () => ({
  useUmtCheckDuplicateUpdatesByCaseId: () => ({
    isPending: false,
    mutateAsync: async () => ({ updates: state.duplicates }),
  }),
  useUmtCreateUpdate: () => ({ isPending: false, mutateAsync: state.createUpdate }),
}));
vi.mock("../api/useUmtBranches", () => ({
  useUmtRequestBranch: () => ({ mutateAsync: state.requestBranch }),
}));

const { default: UmtCreateUpdateDialog } = await import("../components/UmtCreateUpdateDialog");

function hotfixUpdate(overrides: Partial<UmtUpdateSummary> = {}): UmtUpdateSummary {
  return {
    id: 501,
    isHotfix: true,
    jiraId: "SUPPORT-123",
    wso2CaseId: "CS0012345",
    products: [{ productId: 7, product: { name: "wso2am", version: "4.2.0.0.full" } }],
    ...overrides,
  };
}

const onClose = vi.fn();

function renderDialog() {
  render(
    <MemoryRouter>
      <UmtCreateUpdateDialog open onClose={onClose} />
    </MemoryRouter>,
  );
}

async function choose(combobox: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: combobox }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

// Fills in a customer-reported update that is ready to create.
async function fillUpdate({ productName, version, hotfix = false }: { productName: string; version: string; hotfix?: boolean }) {
  fireEvent.change(screen.getByLabelText(/Case ID/), { target: { value: "CS0012345" } });
  if (hotfix) await userEvent.click(screen.getByLabelText("Hotfix"));
  fireEvent.change(screen.getByLabelText(/Public Git Issue/), {
    target: { value: "https://github.com/wso2/product-apim/issues/34" },
  });
  fireEvent.change(screen.getByLabelText(/Internal Git Issue/), {
    target: { value: "https://github.com/wso2-enterprise/wso2-apim-internal/issues/12" },
  });
  await choose("Product", productName);
  await choose("Version", version);
}

const createButton = () => screen.getByRole("button", { name: /^(Create|Creating…|Requesting branch…)$/ });

beforeEach(() => {
  state.duplicates = [];
  state.created = [hotfixUpdate({ isHotfix: false })];
  state.createUpdate.mockReset().mockImplementation(async () => state.created);
  state.requestBranch.mockReset().mockResolvedValue(undefined);
  state.showSuccess.mockClear();
  state.showWarning.mockClear();
  onClose.mockClear();
});

describe("an update at a product's base level", () => {
  it("is created only once the user acknowledges it is the customer level", async () => {
    renderDialog();
    await fillUpdate({ productName: "wso2am", version: "4.2.0.0.full" });

    await userEvent.click(createButton());

    expect(await screen.findByText(/base level of the product/)).toBeInTheDocument();
    expect(state.createUpdate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Acknowledge and Create" }));

    await waitFor(() => expect(state.createUpdate).toHaveBeenCalledTimes(1));
  });

  it("is not created when the acknowledgement is declined, and can still be edited", async () => {
    renderDialog();
    await fillUpdate({ productName: "wso2am", version: "4.2.0.0.full" });
    await userEvent.click(createButton());
    await screen.findByText(/base level of the product/);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText(/base level of the product/)).not.toBeInTheDocument());
    expect(state.createUpdate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Case ID/)).toBeEnabled();
  });

  it("is asked after the duplicate check, so the duplicates are answered first", async () => {
    state.duplicates = [hotfixUpdate({ id: 400, isHotfix: false })];
    renderDialog();
    await fillUpdate({ productName: "wso2am", version: "4.2.0.0.full" });

    await userEvent.click(createButton());
    await userEvent.click(await screen.findByRole("button", { name: "Proceed" }));

    expect(await screen.findByText(/base level of the product/)).toBeInTheDocument();
    expect(state.createUpdate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Acknowledge and Create" }));
    await waitFor(() => expect(state.createUpdate).toHaveBeenCalledTimes(1));
  });

  it("is not asked about for an update at a later level", async () => {
    renderDialog();
    await fillUpdate({ productName: "wso2is", version: "7.0.0.3.full" });

    await userEvent.click(createButton());

    await waitFor(() => expect(state.createUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/base level of the product/)).not.toBeInTheDocument();
  });
});

describe("a new hotfix", () => {
  const isHotfixOf = (productId: number, name: string, version: string) =>
    hotfixUpdate({ products: [{ productId, product: { name, version } }] });

  it("is given its product branch, from the product's public repository, once it is created", async () => {
    state.created = [isHotfixOf(8, "wso2is", "7.0.0.0.full")];
    renderDialog();
    await fillUpdate({ productName: "wso2is", version: "7.0.0.3.full", hotfix: true });

    await userEvent.click(createButton());

    await waitFor(() => expect(state.requestBranch).toHaveBeenCalledTimes(1));
    expect(state.requestBranch).toHaveBeenCalledWith({
      id: 501,
      hotfix: true,
      request: {
        publicRepoUrl: "https://github.com/wso2/product-is",
        releaseTag: "7.0.0.0",
        channel: "full",
        productName: "wso2is",
        branchType: "ProductBranch",
        productVersion: "7.0.0.0",
        jiraId: "SUPPORT-123",
        wso2CaseId: "CS0012345",
      },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(state.showWarning).not.toHaveBeenCalled();
  });

  it("is still created, with a warning, when its branch cannot be requested", async () => {
    state.created = [isHotfixOf(8, "wso2is", "7.0.0.0.full")];
    state.requestBranch.mockRejectedValue(new Error("The request failed"));
    renderDialog();
    await fillUpdate({ productName: "wso2is", version: "7.0.0.3.full", hotfix: true });

    await userEvent.click(createButton());

    await waitFor(() => expect(state.showWarning).toHaveBeenCalledTimes(1));
    expect(state.showWarning).toHaveBeenCalledWith(expect.stringContaining("Branch tab"));
    expect(state.showWarning).toHaveBeenCalledWith(expect.stringContaining("The request failed"));
    expect(state.showSuccess).toHaveBeenCalledWith("Update created successfully.");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("is left to the Branch tab, with a warning, when the product has no public repository", async () => {
    state.created = [isHotfixOf(9, "wso2mi", "4.3.0.0.full")];
    renderDialog();
    await fillUpdate({ productName: "wso2mi", version: "4.3.0.2.full", hotfix: true });

    await userEvent.click(createButton());

    await waitFor(() => expect(state.showWarning).toHaveBeenCalledTimes(1));
    expect(state.requestBranch).not.toHaveBeenCalled();
    expect(state.showWarning).toHaveBeenCalledWith(expect.stringContaining("Branch tab"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("holds the dialog on Requesting branch… until the branch is requested, so no second update is created", async () => {
    state.created = [isHotfixOf(8, "wso2is", "7.0.0.0.full")];
    let finish: () => void = () => {};
    state.requestBranch.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    renderDialog();
    await fillUpdate({ productName: "wso2is", version: "7.0.0.3.full", hotfix: true });

    await userEvent.click(createButton());

    expect(await screen.findByRole("button", { name: "Requesting branch…" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(state.createUpdate).toHaveBeenCalledTimes(1);
  });

  it("is the only kind of update that is given a branch", async () => {
    state.created = [hotfixUpdate({ isHotfix: false })];
    renderDialog();
    await fillUpdate({ productName: "wso2is", version: "7.0.0.3.full" });

    await userEvent.click(createButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(state.requestBranch).not.toHaveBeenCalled();
  });
});
