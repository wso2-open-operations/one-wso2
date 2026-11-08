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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gmailSearchUrl } from "../ccBillingEmail";

// A failed copy reports through the notifications context, rendered here without the provider.
const notify = { showWarning: vi.fn() };
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => notify }));

const { CcBillingEmailIcon } = await import("./CcBillingEmailIcon");

beforeEach(() => notify.showWarning.mockClear());

const billingEmailRef = { messageId: "<a+b@example.com>", subject: "Your <Acme> invoice" };

/** Longer than the tooltip's exit transition. */
const TOOLTIP_EXIT_MS = 600;

const icon = () => screen.getByLabelText("Transaction 3 has a billing email");

async function openTooltip() {
  render(<CcBillingEmailIcon txnId={3} billingEmailRef={billingEmailRef} />);
  await userEvent.hover(icon());
  return screen.findByRole("tooltip");
}

describe("gmailSearchUrl", () => {
  it("encodes the Message-ID", () => {
    expect(gmailSearchUrl("<a+b@example.com>")).toBe(
      "https://mail.google.com/mail/#search/rfc822msgid%3A%3Ca%2Bb%40example.com%3E",
    );
  });
});

describe("CcBillingEmailIcon", () => {
  it("shows the subject in the tooltip under a heading, not as a link", async () => {
    const tip = await openTooltip();
    expect(within(tip).getByText("Billing email subject")).toBeInTheDocument();
    const subject = within(tip).getByText("Your <Acme> invoice");
    expect(subject.closest("a")).toBeNull();
  });

  it("copies the subject to the clipboard", async () => {
    const user = userEvent.setup();
    render(<CcBillingEmailIcon txnId={3} billingEmailRef={billingEmailRef} />);
    await user.hover(icon());
    const tip = await screen.findByRole("tooltip");

    await user.click(within(tip).getByRole("button", { name: "Copy the subject" }));

    expect(await navigator.clipboard.readText()).toBe("Your <Acme> invoice");
    expect(within(tip).getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("stays open when the tooltip is clicked after a copy", async () => {
    const user = userEvent.setup();
    render(<CcBillingEmailIcon txnId={3} billingEmailRef={billingEmailRef} />);
    await user.hover(icon());
    const tip = await screen.findByRole("tooltip");

    await user.click(within(tip).getByRole("button", { name: "Copy the subject" }));
    await user.click(within(tip).getByText("Your <Acme> invoice"));

    // A closing tooltip stays in the document until its exit transition ends, so this waits that out first.
    await new Promise((resolve) => setTimeout(resolve, TOOLTIP_EXIT_MS));
    expect(screen.queryByRole("tooltip")).toBeInTheDocument();
  });

  it("warns when the subject can't be copied", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("Denied"));
    render(<CcBillingEmailIcon txnId={3} billingEmailRef={billingEmailRef} />);
    await user.hover(icon());
    const tip = await screen.findByRole("tooltip");

    await user.click(within(tip).getByRole("button", { name: "Copy the subject" }));

    expect(notify.showWarning).toHaveBeenCalledWith("Couldn't copy the subject");
    expect(within(tip).getByRole("button", { name: "Copy the subject" })).toBeInTheDocument();
  });

  it("opens the email in Gmail in a new tab", async () => {
    const tip = await openTooltip();
    const open = within(tip).getByRole("link", { name: "Open the email in Gmail" });
    expect(open).toHaveAttribute("href", gmailSearchUrl("<a+b@example.com>"));
    expect(open).toHaveAttribute("target", "_blank");
    expect(open).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("takes the tab index it's given", () => {
    const { unmount } = render(<CcBillingEmailIcon txnId={3} billingEmailRef={billingEmailRef} />);
    expect(icon()).toHaveAttribute("tabindex", "0");
    unmount();

    render(<CcBillingEmailIcon txnId={3} billingEmailRef={billingEmailRef} tabIndex={-1} />);
    expect(icon()).toHaveAttribute("tabindex", "-1");
  });
});
