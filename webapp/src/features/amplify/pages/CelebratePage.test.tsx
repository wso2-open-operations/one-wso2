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
import type { ReactNode } from "react";

// Novera's card button links to /amplify/celebrate?share=<campaignId>. When the
// caller already amplified that post there is no share dialog to open, so the
// page answers with a thank-you instead of ignoring the click.
const h = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  refreshMe: vi.fn(async () => {}),
  setSearchParams: vi.fn(),
  navigate: vi.fn(),
  state: {
    params: new URLSearchParams(),
    campaigns: [] as Array<Record<string, unknown>>,
    shares: [] as Array<Record<string, unknown>>,
    sharesPending: false,
    campaignsPending: false,
    linkStatus: "ACTIVE",
    mePending: false,
  },
}));

vi.mock("react-router", () => ({
  useSearchParams: () => [h.state.params, h.setSearchParams],
  useNavigate: () => h.navigate,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: h.showSuccess, showError: h.showError, showWarning: h.showWarning }),
}));

vi.mock("../api/useAmplifyData", async (importOriginal) => ({
  sharesFailedSince: (await importOriginal<typeof import("../api/useAmplifyData")>()).sharesFailedSince,
  useRefreshAmplifyMe: () => h.refreshMe,
  useAmplifyMe: () => ({
    data: h.state.mePending ? undefined : { linkedin: { status: h.state.linkStatus } },
    isPending: h.state.mePending,
  }),
  useAmplifyCampaigns: () => ({
    data: { items: h.state.campaigns },
    isPending: h.state.campaignsPending,
  }),
  useMyShares: () => ({ data: { items: h.state.shares }, isPending: h.state.sharesPending }),
  useAmplifyLeaderboard: () => ({ data: undefined, isPending: true }),
  useAmplifyTopBoard: () => ({ data: undefined, isPending: true }),
  useAmplifyCategories: () => ({ data: [] }),
  useAmplifyConfig: () => ({
    linkedinOrgUrn: "",
    privacyNoticeUrl: "",
    campaignLinkOrigins: ["https://www.linkedin.com", "https://linkedin.com"],
  }),
}));

vi.mock("../api/useAmplifyPeople", () => ({ useAmplifyPeople: () => ({}) }));

vi.mock("../components/AmplifyShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AmplifyPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/PostCard", () => ({
  default: () => null,
  CategoryChip: () => null,
  PriorityChip: () => null,
}));
vi.mock("../components/PostCarousel", () => ({ default: () => null }));
vi.mock("../components/LeaderboardPanels", () => ({
  TeamLeaderboardPanel: () => null,
  TopAmplifiersPanel: () => null,
}));
vi.mock("../components/LinkLinkedInDialog", () => ({
  default: ({
    open,
    onClose,
    pendingCampaignId,
    reconnect,
  }: {
    open: boolean;
    onClose: () => void;
    pendingCampaignId?: string;
    reconnect?: boolean;
  }) =>
    open ? (
      <div>
        link dialog: {pendingCampaignId} {reconnect ? "reconnect" : "connect"}
        <button type="button" onClick={onClose}>
          close link
        </button>
      </div>
    ) : null,
}));
vi.mock("../components/ShareDialog", () => ({
  default: ({
    campaign,
    onNeedsReconnect,
  }: {
    campaign: { title: string } | null;
    onNeedsReconnect?: (c: { title: string }) => void;
  }) =>
    campaign ? (
      <div>
        share dialog: {campaign.title}
        <button type="button" onClick={() => onNeedsReconnect?.(campaign)}>
          post says reconnect
        </button>
      </div>
    ) : null,
}));

import CelebratePage from "./CelebratePage";

const campaign = (id: string, title: string, resourceUrn = `urn:li:share:${id}`) => ({
  id,
  title,
  categoryCode: "PRODUCT",
  isPriority: false,
  status: "OPEN",
  resourceUrn,
  tags: [],
  opensAt: "2026-11-01T00:00:00Z",
  closesAt: "2026-11-30T00:00:00Z",
  version: 1,
});

const share = (campaignId: string, status = "PUBLISHED", failureReason: string | null = null) => ({
  id: `share-${campaignId}`,
  campaignId,
  status,
  failureReason,
});

describe("CelebratePage and the Novera share link", () => {
  beforeEach(() => {
    h.showSuccess.mockClear();
    h.setSearchParams.mockClear();
    h.state.params = new URLSearchParams();
    h.state.campaigns = [campaign("c1", "Launch week")];
    h.state.shares = [];
    h.state.sharesPending = false;
    h.state.campaignsPending = false;
    h.state.linkStatus = "ACTIVE";
    h.state.mePending = false;
  });

  it("thanks the caller when the linked post is already amplified, and clears the link", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.shares = [share("c1")];
    render(<CelebratePage />);
    expect(h.showSuccess).toHaveBeenCalledWith(
      "Thank you for already amplifying this campaign: Launch week",
    );
    expect(h.setSearchParams).toHaveBeenCalledWith({}, { replace: true });
    expect(screen.queryByText("share dialog: Launch week")).toBeNull();
  });

  it("opens the share dialog when the post has not been amplified yet", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    render(<CelebratePage />);
    expect(screen.getByText("share dialog: Launch week")).toBeTruthy();
    expect(h.showSuccess).not.toHaveBeenCalled();
    expect(h.setSearchParams).not.toHaveBeenCalled();
  });

  it("opens the LinkedIn consent popup when an unlinked caller follows the card link", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.linkStatus = "NOT_CONNECTED";
    render(<CelebratePage />);
    expect(screen.getByText(/link dialog: c1 connect/)).toBeTruthy();
    expect(screen.queryByText("share dialog: Launch week")).toBeNull();
    expect(h.showSuccess).not.toHaveBeenCalled();
  });

  it("asks an expired link to reconnect", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.linkStatus = "NEEDS_RECONNECT";
    render(<CelebratePage />);
    expect(screen.getByText(/link dialog: c1 reconnect/)).toBeTruthy();
  });

  it("clears the link param when the consent popup is dismissed", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.linkStatus = "NOT_CONNECTED";
    render(<CelebratePage />);
    fireEvent.click(screen.getByRole("button", { name: "close link" }));
    expect(h.setSearchParams).toHaveBeenCalledWith({}, { replace: true });
  });

  it("thanks an unlinked caller whose post is already amplified, without a consent popup", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.linkStatus = "NOT_CONNECTED";
    h.state.shares = [share("c1")];
    render(<CelebratePage />);
    expect(h.showSuccess).toHaveBeenCalledWith(
      "Thank you for already amplifying this campaign: Launch week",
    );
    expect(screen.queryByText(/link dialog/)).toBeNull();
  });

  it("waits for /me before deciding whether consent is needed", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.mePending = true;
    render(<CelebratePage />);
    expect(screen.queryByText(/link dialog/)).toBeNull();
    expect(h.showSuccess).not.toHaveBeenCalled();
  });

  it("retries a FAILED share instead of thanking the caller", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.shares = [share("c1", "FAILED")];
    render(<CelebratePage />);
    expect(screen.getByText("share dialog: Launch week")).toBeTruthy();
    expect(h.showSuccess).not.toHaveBeenCalled();
  });

  it("still thanks the caller when the post has since left the open list", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.campaigns = [];
    h.state.shares = [share("c1")];
    render(<CelebratePage />);
    expect(h.showSuccess).toHaveBeenCalledWith("Thank you for already amplifying this campaign.");
    expect(h.setSearchParams).toHaveBeenCalledWith({}, { replace: true });
  });

  it("accepts a LinkedIn post id in place of the campaign id", () => {
    h.state.params = new URLSearchParams({ share: "7411000001" });
    h.state.campaigns = [campaign("c-1", "Launch week", "urn:li:share:7411000001")];
    h.state.shares = [share("c-1")];
    render(<CelebratePage />);
    expect(h.showSuccess).toHaveBeenCalledWith(
      "Thank you for already amplifying this campaign: Launch week",
    );
    expect(h.setSearchParams).toHaveBeenCalledWith({}, { replace: true });
  });

  it("opens the share dialog from a LinkedIn post URL", () => {
    h.state.params = new URLSearchParams({
      share: "https://www.linkedin.com/feed/update/urn:li:share:7411000001/",
    });
    h.state.campaigns = [campaign("c-1", "Launch week", "urn:li:share:7411000001")];
    render(<CelebratePage />);
    expect(screen.getByText("share dialog: Launch week")).toBeTruthy();
    expect(h.showSuccess).not.toHaveBeenCalled();
  });

  it("waits for the shares before answering, so an unloaded list is not treated as amplified", () => {
    h.state.params = new URLSearchParams({ share: "c1" });
    h.state.sharesPending = true;
    render(<CelebratePage />);
    expect(h.showSuccess).not.toHaveBeenCalled();
    expect(h.setSearchParams).not.toHaveBeenCalled();
  });
});

// Staging report: "I revoked the Amplify app access from my LinkedIn account and tried to amplify a post. But the
// app didn't prompt me to sign in to LinkedIn again." A share that fails NEEDS_RECONNECT now says so, refetches
// /me and opens the link dialog in reconnect mode, and the next Amplify click does the same.
describe("CelebratePage when LinkedIn stops accepting the link", () => {
  beforeEach(() => {
    h.showSuccess.mockClear();
    h.showError.mockClear();
    h.showWarning.mockClear();
    h.refreshMe.mockClear();
    h.setSearchParams.mockClear();
    h.state.params = new URLSearchParams();
    h.state.campaigns = [campaign("c1", "Launch week")];
    h.state.shares = [share("c1", "QUEUED")];
    h.state.sharesPending = false;
    h.state.campaignsPending = false;
    h.state.linkStatus = "ACTIVE";
    h.state.mePending = false;
  });

  it("refetches /me, says so and opens the reconnect dialog when a queued share fails NEEDS_RECONNECT", () => {
    const { rerender } = render(<CelebratePage />);
    expect(screen.queryByText(/link dialog/)).toBeNull();
    h.state.shares = [share("c1", "FAILED", "NEEDS_RECONNECT")];
    rerender(<CelebratePage />);
    expect(h.refreshMe).toHaveBeenCalledTimes(1);
    expect(h.showWarning).toHaveBeenCalledWith(
      "Your LinkedIn link was disconnected. Link LinkedIn again to amplify this post.",
    );
    expect(screen.getByText(/link dialog: c1 reconnect/)).toBeTruthy();
  });

  it("keeps the next Amplify click on the reconnect dialog even while /me still says ACTIVE", () => {
    const { rerender } = render(<CelebratePage />);
    h.state.shares = [share("c1", "FAILED", "NEEDS_RECONNECT")];
    rerender(<CelebratePage />);
    fireEvent.click(screen.getByRole("button", { name: "close link" }));
    expect(screen.queryByText(/link dialog/)).toBeNull();
    // The Novera link path decides the same way the card's Amplify button does.
    h.state.params = new URLSearchParams({ share: "c1" });
    rerender(<CelebratePage />);
    expect(screen.getByText(/link dialog: c1 reconnect/)).toBeTruthy();
    expect(screen.queryByText("share dialog: Launch week")).toBeNull();
  });

  it("shows a short message for a share LinkedIn rejected, without asking to relink", () => {
    const { rerender } = render(<CelebratePage />);
    h.state.shares = [share("c1", "FAILED", "PROVIDER_REJECTED")];
    rerender(<CelebratePage />);
    expect(h.showError).toHaveBeenCalledWith('LinkedIn didn\'t accept your repost of "Launch week". Try amplifying it again.');
    expect(h.refreshMe).not.toHaveBeenCalled();
    expect(screen.queryByText(/link dialog/)).toBeNull();
  });

  it("shows a short message when the retries ran out", () => {
    const { rerender } = render(<CelebratePage />);
    h.state.shares = [share("c1", "FAILED", "RETRIES_EXHAUSTED")];
    rerender(<CelebratePage />);
    expect(h.showError).toHaveBeenCalledWith('We couldn\'t post your repost of "Launch week" to LinkedIn. Try amplifying it again.');
  });

  it("stays quiet about shares that had already failed when the page loaded", () => {
    h.state.shares = [share("c1", "FAILED", "NEEDS_RECONNECT")];
    render(<CelebratePage />);
    expect(h.showWarning).not.toHaveBeenCalled();
    expect(h.showError).not.toHaveBeenCalled();
  });

  it("treats a POST /shares CONNECTION_NEEDS_RECONNECT the same way", () => {
    h.state.shares = [];
    h.state.params = new URLSearchParams({ share: "c1" });
    render(<CelebratePage />);
    fireEvent.click(screen.getByRole("button", { name: "post says reconnect" }));
    expect(h.refreshMe).toHaveBeenCalledTimes(1);
    expect(h.showWarning).toHaveBeenCalledWith(
      "Your LinkedIn link was disconnected. Link LinkedIn again to amplify this post.",
    );
    expect(screen.getByText(/link dialog: c1 reconnect/)).toBeTruthy();
    expect(screen.queryByText("share dialog: Launch week")).toBeNull();
  });
});
