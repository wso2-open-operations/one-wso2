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
import { describe, expect, it } from "vitest";
import type { JSX } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { emptyDraftForm, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import BillingFrequencyCard from "./BillingFrequencyCard";

function Held(): JSX.Element {
  const billing = useWatch<DraftFormValues, "billingFrequency">({ name: "billingFrequency" });
  return <output aria-label="Held">{billing || "no billing"}</output>;
}

function Harness({ values = {} }: { values?: Partial<DraftFormValues> }): JSX.Element {
  const form = useForm<DraftFormValues>({ defaultValues: { ...emptyDraftForm(), ...values } });
  return (
    <FormProvider {...form}>
      <BillingFrequencyCard />
      <Held />
    </FormProvider>
  );
}

// D85; its own card since D86, with See Special Terms.
describe("Billing Frequency card", () => {
  it("starts on annually in advance and offers the five billing frequencies", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("region", { name: "Billing Frequency" })).toBeInTheDocument();
    expect(screen.getByLabelText("Held")).toHaveTextContent("ANNUAL");
    await user.click(screen.getByRole("combobox", { name: /Billing frequency/ }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Monthly in Advance",
      "Quarterly in Advance",
      "Annually in Advance",
      "Upon the Execution of the Order Form",
      "See Special Terms",
    ]);
    await user.click(screen.getByRole("option", { name: "Monthly in Advance" }));
    expect(screen.getByLabelText("Held")).toHaveTextContent("MONTHLY");
  });

  it("points at the special terms when the billing says See Special Terms", () => {
    render(<Harness values={{ billingFrequency: "SPECIAL_TERMS" }} />);
    expect(screen.getByText("Describe the billing in the special terms, on the Legal step.")).toBeInTheDocument();
  });
});
