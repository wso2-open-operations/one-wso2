/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dismissAutofillGuide } from "../ccAutofillGuideStore";
import { CcAutofillGuideCard, CcAutofillGuideDialog } from "./CcAutofillGuide";

afterEach(() => localStorage.clear());

const INBOX = "card-invoices@wso2.com";
const showCard = (hasRules = true) => render(<CcAutofillGuideCard sub="sub-jane" hasRules={hasRules} />);
const showDialog = (inbox = INBOX) =>
  render(<CcAutofillGuideDialog open onClose={vi.fn()} inbox={inbox} workEmail="jane@wso2.com" />);
const steps = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("CcAutofillGuideCard", () => {
  it("shows the guide until it is dismissed, per user", async () => {
    const { unmount } = showCard();
    expect(screen.getByText(/Autofill attaches your bills/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/Autofill attaches your bills/)).not.toBeInTheDocument();

    unmount();
    showCard();
    expect(screen.queryByText(/Autofill attaches your bills/)).not.toBeInTheDocument();
  });

  it("hides the guide for now only when the user isn't known yet", async () => {
    const { unmount } = render(<CcAutofillGuideCard sub={undefined} hasRules />);
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/Autofill attaches your bills/)).not.toBeInTheDocument();

    unmount();
    render(<CcAutofillGuideCard sub={undefined} hasRules />);
    expect(screen.getByText(/Autofill attaches your bills/)).toBeInTheDocument();
  });

  it("keeps showing the guide while there are no rules, with nothing to dismiss", () => {
    dismissAutofillGuide("sub-jane");
    showCard(false);

    expect(screen.getByText(/Autofill attaches your bills/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Got it" })).not.toBeInTheDocument();
  });

  it("points to the guide beside Add Rule, with no button of its own for it", () => {
    showCard();
    expect(screen.getByText(/To see how/)).toHaveTextContent(/To see how, select How it works beside Add Rule\.$/);
    expect(screen.getByText("Add Rule").tagName).toBe("STRONG");
    expect(screen.queryByRole("button", { name: "How it works" })).not.toBeInTheDocument();
  });
});

describe("CcAutofillGuideDialog", () => {
  it("walks through the four steps, starting with the billing address", () => {
    showDialog();

    expect(screen.getByRole("dialog", { name: "How autofill works" })).toBeInTheDocument();
    expect(steps()).toEqual([
      "Send your bills to your billing address",
      "The receipt is attached for you",
      "Your rules fill in the details",
      "New suppliers get a rule to set up",
    ]);
    expect(screen.getByText("card-invoices+jane@wso2.com")).toBeInTheDocument();
  });

  it("copies the billing address", async () => {
    const user = userEvent.setup();
    showDialog();

    await user.click(screen.getByRole("button", { name: "Copy billing address" }));

    expect(await navigator.clipboard.readText()).toBe("card-invoices+jane@wso2.com");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("leaves out the address step when the inbox isn't configured", () => {
    showDialog("");

    expect(steps()).toEqual([
      "The receipt is attached for you",
      "Your rules fill in the details",
      "New suppliers get a rule to set up",
    ]);
    expect(screen.queryByText(/billing address/)).not.toBeInTheDocument();
  });
});
