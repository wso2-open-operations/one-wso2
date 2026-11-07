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
import SpecialTermsEditor from "./SpecialTermsEditor";

const write = { mutate: vi.fn(), isPending: false, error: null as unknown };
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({ useWriteSpecialTerms: () => write }));
vi.mock("@features/sales/cado2/components/toast/toastContext", () => ({ useCado2Toast: () => vi.fn() }));
// The rich-text editor as a plain text box, so the test can type into it.
vi.mock("@features/sales/cado2/components/legal-rich-text/LegalRichTextField", () => ({
  default: ({ label, value, onChange, helperText }: { label: string; value: string; onChange: (v: string) => void; helperText?: string }) => (
    <>
      <textarea aria-label={label} defaultValue={value} onChange={(e) => onChange(e.target.value)} />
      <p>{helperText}</p>
    </>
  ),
}));

const legal = (over: Partial<LegalView> = {}): LegalView => ({
  onPrem: true, saas: false, onPremNonStandard: false, saasNonStandard: false, contractName: "", partnerName: "", contractDate: null,
  sections: { blocks: [], notices: [], contractName: "" }, specialTerms: "<p>AM text</p>", specialTermsBy: "AM",
  specialTermsByLegal: false, amSpecialTerms: "<p>AM text</p>", deskSpecialTerms: null, deskSpecialTermsByEmail: null,
  legalSpecialTermsByEmail: null, frozen: true, ...over,
} as LegalView);

// D139: the AM wrote the special terms; Deal Desk may override them.
describe("SpecialTermsEditor", () => {
  it("overrides the AM's text, pre-filled with it", async () => {
    write.mutate.mockClear();
    render(<SpecialTermsEditor quoteId={7} versionNumber={1} legal={legal()} />);
    const user = userEvent.setup();
    expect(screen.getByText("Written by the AM")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Override special terms" }));
    const box = screen.getByRole("textbox", { name: "Override special terms" });
    expect(box).toHaveValue("<p>AM text</p>");
    expect(screen.getByRole("button", { name: "Save override" })).toBeDisabled();
    await user.clear(box);
    await user.type(box, "Desk text");
    await user.click(screen.getByRole("button", { name: "Save override" }));
    expect(write.mutate).toHaveBeenCalledWith({ specialTerms: expect.stringContaining("Desk text") }, expect.anything());
  });

  it("says who overrode them, shows the AM's text, and goes back to it", async () => {
    write.mutate.mockClear();
    render(
      <SpecialTermsEditor
        quoteId={7}
        versionNumber={1}
        legal={legal({ specialTerms: "<p>Desk text</p>", specialTermsBy: "DEAL_DESK", deskSpecialTerms: "<p>Desk text</p>", deskSpecialTermsByEmail: "priya@wso2.com" })}
      />,
    );
    const user = userEvent.setup();
    expect(screen.getByText(/Overridden by priya \(Deal Desk\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show what the AM wrote" }));
    expect(screen.getByText("AM text")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use the AM's text again" }));
    expect(write.mutate).toHaveBeenCalledWith({ specialTerms: "<p>AM text</p>" }, expect.anything());
  });

  it("has nothing to override on a quote without special terms", () => {
    render(<SpecialTermsEditor quoteId={7} versionNumber={1} legal={legal({ specialTerms: null, amSpecialTerms: null })} />);
    expect(screen.getByText("The AM added no special terms to this quote.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Override special terms" })).toBeNull();
  });
});
