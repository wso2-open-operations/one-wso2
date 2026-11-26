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

const mutate = vi.fn();
const showSuccess = vi.fn();
const openOnLinkedIn = vi.fn();
const native = vi.hoisted(() => ({ enabled: false }));
vi.mock("../api/useAmplifyMutations", () => ({ useRequestShare: () => ({ mutate, isPending: false }) }));
vi.mock("../api/useOpenOnLinkedIn", () => ({ useOpenOnLinkedIn: () => ({ open: openOnLinkedIn, busy: false }) }));
vi.mock("../api/useAmplifyData", () => ({
  useNativeRepostEnabled: () => native.enabled,
  usePointValues: () => ({ data: { REPOST: 2, REPOST_COMMENTARY: 5 } }),
  useAmplifyConfig: () => ({ linkedinOrgUrn: "urn:li:organization:1", privacyNoticeUrl: "https://example.test/privacy", campaignLinkOrigins: ["https://www.linkedin.com", "https://linkedin.com"] }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess }),
}));

import ShareDialog, { SHARE_QUEUED_MESSAGE } from "./ShareDialog";
import type { Campaign } from "../api/amplifyTypes";

describe("ShareDialog", () => {
  const campaign = {
    id: "c-1",
    title: "WSO2 Integrator 5.0 is here",
    resourceUrn: "urn:li:share:1",
    opensAt: "2026-10-18T00:00:00Z",
    categoryCode: "PRODUCT",
    isPriority: true,
  } as Campaign;
  beforeEach(() => {
    mutate.mockReset();
    showSuccess.mockClear();
    openOnLinkedIn.mockClear();
    native.enabled = false;
  });

  it("asks for a REPOST of the post, not a new post that links to it", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Amplify, share this for me" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ campaignId: "c-1", kind: "REPOST" });
  });

  const thoughts = () => screen.getByLabelText(/Add your thoughts/);

  it("shows the post's title and date above the Let Amplify post it for you box", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(screen.getByText("Amplify this post")).toBeTruthy();
    expect(screen.getByText("WSO2 Integrator 5.0 is here")).toBeTruthy();
    expect(screen.getByText(/^Choreo Labs on LinkedIn · /)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Let Amplify post it for you" })).toBeTruthy();
    expect(screen.getByText("Say why it matters to you, in your own words. It shows above the repost.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("counts the employee's own words toward the with-your-thoughts points", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toBe("0 of 5 own words for +5");
    // "WSO2", "Integrator" and "here" are the post's title words; #tags and one-letter words don't count.
    fireEvent.change(thoughts(), { target: { value: "WSO2 Integrator is here: proud of a great team #wso2" } });
    expect(screen.getByRole("status").textContent).toBe("4 of 5 own words for +5");
    fireEvent.change(thoughts(), { target: { value: "Proud of this team, come say hello" } });
    expect(screen.getByRole("status").textContent).toBe("5 of 5 own words for +5");
  });

  it("closes from the close button", () => {
    const onClose = vi.fn();
    render(<ShareDialog campaign={campaign} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sends REPOST_COMMENTARY with the trimmed text when the employee adds thoughts", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "  Proud of this team  " } });
    fireEvent.click(screen.getByRole("button", { name: "Amplify, share this for me" }));
    expect(mutate.mock.calls[0][0]).toEqual({
      campaignId: "c-1",
      kind: "REPOST_COMMENTARY",
      commentary: "Proud of this team",
    });
  });

  it("stays a plain REPOST when the thoughts are only whitespace", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Amplify, share this for me" }));
    expect(mutate.mock.calls[0][0]).toEqual({ campaignId: "c-1", kind: "REPOST" });
  });

  it("says the share is queued and may take a while, since shares go out one at a time", () => {
    mutate.mockImplementation((_body, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Amplify, share this for me" }));
    expect(showSuccess).toHaveBeenCalledWith(SHARE_QUEUED_MESSAGE);
    expect(SHARE_QUEUED_MESSAGE).toMatch(/one at a time/);
  });

  it("caps the text at the API limit", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(thoughts().getAttribute("maxlength")).toBe("3000");
  });

  it("offers no Repost it on LinkedIn yourself while the setting is off", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(screen.queryByRole("region", { name: "Repost it on LinkedIn yourself" })).toBeNull();
    expect(screen.queryByText(/Both earn the same points/)).toBeNull();
  });

  it("recommends reposting on LinkedIn yourself when the setting is on, with the points", () => {
    native.enabled = true;
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(screen.getByText("Choose how you'd like to share it. Both earn the same points.")).toBeTruthy();
    const region = screen.getByRole("region", { name: "Repost it on LinkedIn yourself" });
    expect(region.textContent).toContain("Recommended");
    expect(region.textContent).toContain("Repost +2 · with your own thoughts +5");
    expect(region.textContent).toContain("Safest for your account: LinkedIn sees you, not an app");
  });

  it("opens the post on LinkedIn and closes, from Open on LinkedIn", () => {
    native.enabled = true;
    const onClose = vi.fn();
    render(<ShareDialog campaign={campaign} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Open on LinkedIn" }));
    expect(openOnLinkedIn).toHaveBeenCalledWith(campaign);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });
});
