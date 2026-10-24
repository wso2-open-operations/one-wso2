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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LegalView } from "@features/sales/cado2/quotes/api/quoteTypes";
import LegalTermsEditor from "./LegalTermsEditor";

const write = { mutate: vi.fn(), isPending: false, error: null as unknown };
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({ useWriteLegalTerms: () => write }));
// The rich-text editor as a plain text box, so the test can type into it.
vi.mock("@features/sales/cado2/components/legal-rich-text/LegalRichTextField", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <textarea aria-label={label} defaultValue={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const legal: LegalView = {
  onPrem: true, saas: true, onPremNonStandard: false, saasNonStandard: true,
  contractName: "Value Added Reseller", partnerName: "Acme Reseller", contractDate: "2024-03-12",
  sections: {
    blocks: [{ kind: "ONPREM", nonStandard: false, text: "Standard." }, { kind: "SAAS", nonStandard: true, text: "" }],
    notices: [], contractName: "Value Added Reseller",
  },
  specialTerms: "AM's wording", specialTermsByLegal: false, amSpecialTerms: "AM's wording", frozen: true,
};

// Legal writes the non-standard terms and may reword the special terms.
describe("LegalTermsEditor", () => {
  it("lets Legal write the non-standard terms and reword the special terms, then saves them", async () => {
    render(<LegalTermsEditor quoteId={7} versionNumber={1} legal={legal} />);
    const user = userEvent.setup();
    expect(screen.getByText(/Value Added Reseller · Acme Reseller · 2024-03-12/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /On-premises products/ })).toBeNull(); // standard: nothing to write
    const saveButton = screen.getByRole("button", { name: "Save terms" });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /SaaS products: governing terms/ }), "Bespoke SaaS terms.");
    const special = screen.getByRole("textbox", { name: "Special terms" });
    await user.clear(special);
    await user.type(special, "Legal's wording");
    await user.click(saveButton);
    expect(write.mutate).toHaveBeenCalledWith(
      { onPremTerms: undefined, saasTerms: "Bespoke SaaS terms.", specialTerms: "Legal's wording" },
      expect.anything(),
    );
  });

  it("says the terms are standard when there is nothing to write", () => {
    render(
      <LegalTermsEditor
        quoteId={7}
        versionNumber={1}
        legal={{ ...legal, saasNonStandard: false, sections: { ...legal.sections, blocks: [legal.sections.blocks[0]] }, specialTerms: null }}
      />,
    );
    expect(screen.getByText("The terms on this quote are standard.")).toBeInTheDocument();
  });
});
