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

import { useState, type JSX } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewLens } from "@features/sales/cado2/approvals/api/approvalTypes";
import ReviewNotes from "./ReviewNotes";

const lens: ReviewLens = {
  role: "DEAL_DESK", roleLabel: "Deal Desk",
  notes: [{
    key: "SPECIAL_TERMS", rule: "SPECIAL_TERMS", lineNumber: 0, reasons: ["The quote includes special terms", "The AM added special terms. Check them, override if needed"],
    roles: ["Legal"], target: "specialTerms", yoursToWrite: false, state: "OPEN",
  }],
};

/** A quote with one marked place that holds a control, like an editor's Save. */
function Page({ onSave }: { onSave: () => void }): JSX.Element {
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  return (
    <>
      <div ref={setSheet}>
        <div data-note-target="specialTerms">
          Special terms
          <button type="button" onClick={onSave}>
            Save special terms
          </button>
        </div>
      </div>
      <ReviewNotes lens={lens} sheet={sheet} empty="" />
    </>
  );
}

// D129: a marked place selects its note, and the controls inside it still work.
describe("ReviewNotes", () => {
  it("marks the place, selects the note on a click there, and leaves its controls working", async () => {
    // The test DOM lays nothing out; the panel treats size-less places as hidden (a folded year).
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList);
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Page onSave={onSave} />);
    const place = screen.getByText("Special terms", { selector: "div" });
    expect(place).toHaveAttribute("data-note-state", "open");

    await user.click(screen.getByRole("button", { name: "Save special terms" }));
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(place);
    const card = screen.getByRole("article", { name: "Special terms from the AM" });
    expect(card).toHaveAttribute("aria-current", "true");
    expect(card).toHaveTextContent("Check them, override if needed");
    // D140: a plain list, nothing to mark.
    expect(screen.queryByRole("button", { name: "Looks fine" })).toBeNull();
  });
});
