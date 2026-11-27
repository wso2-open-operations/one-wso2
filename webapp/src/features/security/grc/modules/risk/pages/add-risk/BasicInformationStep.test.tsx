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

import { useEffect } from "react";
import type { JSX } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SuggestCategoryResult } from "../../api/riskApi";
import BasicInformationStep from "./BasicInformationStep";
import { categoryBasis } from "./suggestionBasis";
import type { AddRiskFormValues } from "./types";

vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

const suggestCategory = vi.hoisted(() => vi.fn());
vi.mock("../../api/riskApi", async (importActual) => ({
  ...(await importActual<typeof import("../../api/riskApi")>()),
  suggestCategory,
  fetchRiskAssignerCandidates: vi.fn().mockResolvedValue([]),
}));

let form: UseFormReturn<AddRiskFormValues>;
const setForm = (f: UseFormReturn<AddRiskFormValues>): void => {
  form = f;
};

function Harness({ onForm }: { onForm: (f: UseFormReturn<AddRiskFormValues>) => void }): JSX.Element {
  const methods = useForm<AddRiskFormValues>({
    defaultValues: {
      riskTitle: "Title",
      riskDescription: "Description",
      complianceReferences: [],
      riskCategory: "",
      aiCategorySuggestion: null,
    } as unknown as AddRiskFormValues,
  });
  useEffect(() => {
    onForm(methods);
  }, [methods, onForm]);
  return (
    <FormProvider {...methods}>
      <BasicInformationStep
        riskSequenceId={1}
        sourceRegisterTeams={[]}
        complianceRefs={[]}
        riskCategories={[
          { id: 1, name: "Secrets", description: null },
          { id: 2, name: "Access", description: null },
        ]}
        lookups={{ platforms: [], customers: [], products: [], deploymentTypes: [] }}
        onCustomerAdded={vi.fn()}
      />
    </FormProvider>
  );
}

const answer = (categoryId: number): SuggestCategoryResult => ({
  category_id: categoryId,
  category_name: "x",
  reason: "Because of secrets",
  confidence: "high",
});

// A request the test settles by hand, so the form can be edited while it runs.
function pendingRequest(): { resolve: (r: SuggestCategoryResult) => void } {
  let resolve!: (r: SuggestCategoryResult) => void;
  suggestCategory.mockReturnValueOnce(new Promise<SuggestCategoryResult>((r) => (resolve = r)));
  return { resolve: (r) => resolve(r) };
}

beforeEach(() => suggestCategory.mockReset());

describe("BasicInformationStep category suggestion", () => {
  it("keeps the suggestion for the backend but hides the banner when another category is picked", async () => {
    suggestCategory.mockReset().mockResolvedValue(answer(1));
    render(<Harness onForm={setForm} />);

    await userEvent.click(screen.getByRole("button", { name: "Suggest category" }));
    expect(await screen.findByText(/Because of secrets/)).toBeInTheDocument();

    act(() => form.setValue("riskCategory", 2));

    await waitFor(() => expect(screen.queryByText(/Because of secrets/)).not.toBeInTheDocument());
    expect(form.getValues("aiCategorySuggestion")?.categoryId).toBe(1);
  });

  it("does not overwrite a category the user picked while the request was running", async () => {
    const request = pendingRequest();
    render(<Harness onForm={setForm} />);

    await userEvent.click(screen.getByRole("button", { name: "Suggest category" }));
    act(() => form.setValue("riskCategory", 2));
    await act(async () => request.resolve(answer(1)));

    expect(form.getValues("riskCategory")).toBe(2);
    expect(form.getValues("aiCategorySuggestion")).toBeNull();
  });

  it("drops a response made for text that changed while the request was running", async () => {
    const request = pendingRequest();
    render(<Harness onForm={setForm} />);

    await userEvent.click(screen.getByRole("button", { name: "Suggest category" }));
    act(() => form.setValue("riskDescription", "Edited description"));
    await act(async () => request.resolve(answer(1)));

    expect(form.getValues("riskCategory")).toBe("");
    expect(form.getValues("aiCategorySuggestion")).toBeNull();
  });

  it("applies a response when nothing changed", async () => {
    const request = pendingRequest();
    render(<Harness onForm={setForm} />);

    await userEvent.click(screen.getByRole("button", { name: "Suggest category" }));
    await act(async () => request.resolve(answer(1)));

    expect(form.getValues("riskCategory")).toBe(1);
    expect(form.getValues("aiCategorySuggestion")?.basis).toBe(categoryBasis("Title", "Description", []));
  });
});
