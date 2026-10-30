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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const startMutate = vi.fn();
const declineMutate = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({
  useStartLinkedInConnect: () => ({ mutate: startMutate, isPending: false }),
  useDeclineLinkedInConsent: () => ({ mutate: declineMutate, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));
vi.mock("@config/apiConfig", () => ({ amplifyPrivacyNoticeUrl: "https://example.test/privacy" }));

import LinkLinkedInDialog from "./LinkLinkedInDialog";
import { isLinkedInProfileUrl } from "../util/linkedinProfile";

const onClose = vi.fn();
const onDeclined = vi.fn();
const renderDialog = () =>
  render(<LinkLinkedInDialog open onClose={onClose} onDeclined={onDeclined} returnTo="/amplify/celebrate" />);

describe("LinkLinkedInDialog", () => {
  beforeEach(() => {
    startMutate.mockClear();
    declineMutate.mockClear();
    onClose.mockClear();
    onDeclined.mockClear();
  });

  it("keeps the title and shows the consent copy with the privacy notice link", () => {
    renderDialog();
    expect(screen.getByText("Link Your LinkedIn Account")).toBeTruthy();
    expect(screen.getByText(/By using the Amplify App, I agree to connect my LinkedIn profile/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "WSO2 Employee Privacy Notice" });
    expect(link.getAttribute("href")).toBe("https://example.test/privacy");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("starts the LinkedIn link when the employee consents", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "I consent" }));
    expect(startMutate.mock.calls[0][0]).toEqual({ returnTo: "/amplify/celebrate", pendingCampaignId: undefined });
  });

  it("asks for the profile URL after I don't consent and blocks Next only for an invalid one", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "I don't consent" }));
    const next = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    const field = screen.getByLabelText("LinkedIn profile URL (optional)");
    fireEvent.change(field, { target: { value: "https://evil.example/in/scott" } });
    expect(next.disabled).toBe(true);
    fireEvent.change(field, { target: { value: " https://www.linkedin.com/in/scott-bechtel " } });
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(declineMutate.mock.calls[0][0]).toEqual({ profileUrl: "https://www.linkedin.com/in/scott-bechtel" });
    expect(startMutate).not.toHaveBeenCalled();
  });

  it("Back on the decline step clears the popup and goes to Celebrate, not back to consent", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "I don't consent" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onDeclined).toHaveBeenCalledTimes(1);
    expect(declineMutate).not.toHaveBeenCalled();
  });

  it("lets Next through with no URL and sends none", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "I don't consent" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(declineMutate.mock.calls[0][0]).toEqual({ profileUrl: undefined });
  });

  it("hands back to the page (close everything, back to Celebrate) once the URL is saved", () => {
    declineMutate.mockImplementation((_body, opts) => opts.onSuccess());
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "I don't consent" }));
    fireEvent.change(screen.getByLabelText("LinkedIn profile URL (optional)"), {
      target: { value: "https://www.linkedin.com/in/scott-bechtel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onDeclined).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("isLinkedInProfileUrl", () => {
  it("accepts member profile URLs only", () => {
    expect(isLinkedInProfileUrl("https://www.linkedin.com/in/scott-bechtel/")).toBe(true);
    expect(isLinkedInProfileUrl("http://www.linkedin.com/in/scott-bechtel")).toBe(false);
    expect(isLinkedInProfileUrl("https://www.linkedin.com/company/wso2")).toBe(false);
    expect(isLinkedInProfileUrl("https://www.linkedin.com.evil.com/in/scott-bechtel")).toBe(false);
    expect(isLinkedInProfileUrl("https://www.linkedin.com/in/scott-bechtel?x=1")).toBe(false);
  });
});
