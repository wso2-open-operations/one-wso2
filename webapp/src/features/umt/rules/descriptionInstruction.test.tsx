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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// The Description and Instruction form (also rendered by Validate), checked
// at the wire: what it refuses to save, and what it PUTs. The real save hook
// runs; only the HTTP helper is stubbed.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UmtUpdateProduct, UmtUpdateSummary } from "../api/umtUpdates";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedPut = vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve(null));
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedPut: (...args: unknown[]) => authedPut(...args) };
});

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

// `@config/apiConfig` reads `window.config` at module load.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { default: UmtDescriptionInstructionForm } = await import("../components/edit/UmtDescriptionInstructionForm");
const { umtServiceUrls } = await import("@config/apiConfig");

const DESCRIBED: UmtUpdateProduct = {
  productId: 1,
  product: { name: "wso2am", version: "4.2.0.15.full" },
  description: "Fixes the token refresh.",
  instruction: "Restart the server.",
  testPr: "https://github.com/wso2/product-apim/pull/1",
  ignoreTestReason: "",
  helmChartTag: "4.2.0-15",
};

const UNDESCRIBED: UmtUpdateProduct = {
  productId: 2,
  product: { name: "wso2is", version: "7.0.0.3.full" },
  description: "",
  instruction: "",
};

function makeUpdate(overrides: Partial<UmtUpdateSummary> = {}): UmtUpdateSummary {
  return { id: 42, lifecycleState: "ProductAnalyzed", products: [DESCRIBED], ...overrides };
}

function renderForm(update: UmtUpdateSummary, onDirtyChange?: (dirty: boolean) => void) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UmtDescriptionInstructionForm id="42" update={update} onDirtyChange={onDirtyChange} />
    </QueryClientProvider>,
  );
}

async function tickVerificationBoxes() {
  await userEvent.click(screen.getByRole("checkbox", { name: "General Description" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Implementation details" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Impact" }));
}

const saveButton = () => screen.getByRole("button", { name: "Save" });

function bodySentTo(url: string): unknown {
  return authedPut.mock.calls.find((call) => call[0] === url)?.[2];
}

beforeEach(() => {
  authedPut.mockClear();
});

describe("Description and Instruction save", () => {
  it("holds Save until the three verification boxes are ticked", async () => {
    renderForm(makeUpdate());

    expect(saveButton()).toBeDisabled();
    await tickVerificationBoxes();
    expect(saveButton()).toBeEnabled();
  });

  it("holds Save while a behaviour change is declared but not approved", async () => {
    renderForm(makeUpdate());
    await tickVerificationBoxes();

    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));

    expect(saveButton()).toBeDisabled();
  });

  it("PUTs each product's description and instruction", async () => {
    renderForm(makeUpdate());
    await tickVerificationBoxes();

    await userEvent.click(saveButton());

    await waitFor(() => expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toBeDefined());
    expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toEqual([
      expect.objectContaining({ productId: 1, description: DESCRIBED.description, instruction: DESCRIBED.instruction }),
    ]);
  });

  // Each product's current testPr, ignoreTestReason and helmChartTag go back
  // with the save. Otherwise saving here (or on Validate, in Staging) would
  // erase the Test PRs Staging → UATStaging requires.
  it("keeps each product's Test PR, ignore reason and Helm Chart Tag", async () => {
    renderForm(makeUpdate());
    await tickVerificationBoxes();

    await userEvent.click(saveButton());

    await waitFor(() => expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toBeDefined());
    expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toEqual([
      expect.objectContaining({
        testPr: DESCRIBED.testPr,
        ignoreTestReason: DESCRIBED.ignoreTestReason,
        helmChartTag: DESCRIBED.helmChartTag,
      }),
    ]);
  });

  // The flag is sent as `productBehaviourChanges`; it drives the
  // behaviour-change release email.
  it("saves a declared behaviour change as productBehaviourChanges", async () => {
    renderForm(makeUpdate());
    await tickVerificationBoxes();
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Behavioral change approved/ }));

    await userEvent.click(saveButton());

    await waitFor(() => expect(bodySentTo(umtServiceUrls.update("42"))).toBeDefined());
    expect(bodySentTo(umtServiceUrls.update("42"))).toMatchObject({ productBehaviourChanges: true });
  });

  it("shows a saved behaviour change as Yes", () => {
    renderForm(makeUpdate({ productBehaviourChanges: true } as Partial<UmtUpdateSummary>));

    expect(screen.getByRole("radio", { name: "Yes" })).toBeChecked();
  });

  it("holds Save while a product is left without a description, and says so", async () => {
    renderForm(makeUpdate({ products: [DESCRIBED, UNDESCRIBED] }));
    await tickVerificationBoxes();

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Every product needs a description and instruction before saving.")).toBeInTheDocument();
  });

  it("holds Save after the row for a product is deleted", async () => {
    renderForm(makeUpdate({ products: [DESCRIBED, { ...UNDESCRIBED, description: "Fixes login.", instruction: "None." }] }));
    await tickVerificationBoxes();
    expect(saveButton()).toBeEnabled();

    await userEvent.click(screen.getAllByRole("button", { name: "Delete row" })[0]);

    expect(saveButton()).toBeDisabled();
  });

  it("saves every product once the missing one has been given a description", async () => {
    renderForm(makeUpdate({ products: [DESCRIBED, UNDESCRIBED] }));
    await tickVerificationBoxes();

    await userEvent.click(screen.getByRole("button", { name: "Description and Instructions" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Common Description/ }), {
      target: { value: "Fixes SSO login." },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Common Instructions/ }), {
      target: { value: "Restart the server." },
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(saveButton()).toBeEnabled();
    await userEvent.click(saveButton());

    await waitFor(() => expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toBeDefined());
    expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toEqual([
      expect.objectContaining({ productId: 1 }),
      expect.objectContaining({ productId: 2, description: "Fixes SSO login.", instruction: "Restart the server." }),
    ]);
  });
});

// What the step reports to the wizard, which holds Next while anything is
// unsaved: leaving would discard it.
describe("unsaved changes", () => {
  const lastReport = (onDirtyChange: ReturnType<typeof vi.fn>) => onDirtyChange.mock.calls.at(-1)?.[0];

  it("are not reported while nothing has been edited", () => {
    const onDirtyChange = vi.fn();
    renderForm(makeUpdate(), onDirtyChange);

    expect(lastReport(onDirtyChange)).toBe(false);
  });

  it("are reported once a row is deleted", async () => {
    const onDirtyChange = vi.fn();
    renderForm(makeUpdate({ products: [DESCRIBED, { ...UNDESCRIBED, description: "Fixes login.", instruction: "None." }] }), onDirtyChange);

    await userEvent.click(screen.getAllByRole("button", { name: "Delete row" })[0]);

    expect(lastReport(onDirtyChange)).toBe(true);
  });

  it("are reported when the behaviour change differs from the saved one, and stop when it matches again", async () => {
    const onDirtyChange = vi.fn();
    renderForm(makeUpdate(), onDirtyChange);

    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    expect(lastReport(onDirtyChange)).toBe(true);

    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(lastReport(onDirtyChange)).toBe(false);
  });

  it("are reported when a hotfix's description or instruction differs from the saved one", () => {
    const onDirtyChange = vi.fn();
    renderForm(makeUpdate({ isHotfix: true }), onDirtyChange);
    expect(lastReport(onDirtyChange)).toBe(false);

    fireEvent.change(screen.getByRole("textbox", { name: /Hotfix Description/ }), { target: { value: "Fixes it." } });
    expect(lastReport(onDirtyChange)).toBe(true);

    fireEvent.change(screen.getByRole("textbox", { name: /Hotfix Description/ }), {
      target: { value: DESCRIBED.description },
    });
    expect(lastReport(onDirtyChange)).toBe(false);
  });

  it("are no longer reported once the step is left", () => {
    const onDirtyChange = vi.fn();
    const { unmount } = renderForm(makeUpdate(), onDirtyChange);

    unmount();

    expect(lastReport(onDirtyChange)).toBe(false);
  });
});

describe("hotfix description", () => {
  // A hotfix must have a description, and a blank save would overwrite the
  // real one.
  it("holds Save while the hotfix description is blank", () => {
    renderForm(makeUpdate({ isHotfix: true, products: [UNDESCRIBED] }));

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Add a hotfix description.")).toBeInTheDocument();
  });

  it("treats a whitespace-only hotfix description as blank", async () => {
    renderForm(makeUpdate({ isHotfix: true, products: [DESCRIBED] }));
    const field = screen.getByRole("textbox", { name: /Hotfix Description/ });

    await userEvent.clear(field);
    await userEvent.type(field, "   ");

    expect(saveButton()).toBeDisabled();
  });

  it("keeps each product's Test PR when saving the hotfix description", async () => {
    renderForm(makeUpdate({ isHotfix: true, products: [DESCRIBED] }));

    await userEvent.click(saveButton());

    await waitFor(() => expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toBeDefined());
    expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toEqual([
      expect.objectContaining({ testPr: DESCRIBED.testPr, helmChartTag: DESCRIBED.helmChartTag }),
    ]);
  });

  it("saves the hotfix description to every product", async () => {
    renderForm(makeUpdate({ isHotfix: true, products: [DESCRIBED, { ...UNDESCRIBED }] }));

    await userEvent.click(saveButton());

    await waitFor(() => expect(bodySentTo(umtServiceUrls.updateProductsDetails("42"))).toBeDefined());
    const body = bodySentTo(umtServiceUrls.updateProductsDetails("42")) as { description: string }[];
    expect(body.map((row) => row.description)).toEqual([DESCRIBED.description, DESCRIBED.description]);
  });
});
