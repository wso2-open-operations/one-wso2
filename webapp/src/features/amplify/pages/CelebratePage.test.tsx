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
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

// Novera's card button links to /amplify/celebrate?share=<campaignId>. When the
// caller already amplified that post there is no share dialog to open, so the
// page answers with a thank-you instead of ignoring the click.
const h = vi.hoisted(() => ({
  showSuccess: vi.fn(),
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
    nativeRepost: false,
    intents: [] as Array<Record<string, unknown>>,
    intentsAskedWith: [] as boolean[],
  },
}));

vi.mock("react-router", () => ({
  useSearchParams: () => [h.state.params, h.setSearchParams],
  useNavigate: () => h.navigate,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: h.showSuccess, showError: vi.fn(), showWarning: vi.fn() }),
}));

vi.mock("../api/useAmplifyData", () => ({
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
  useAmplifyCategories: () => ({ data: [{ code: "PRODUCT", label: "Product", sortOrder: 1 }] }),
  usePointValues: () => ({ data: { REPOST: 2, REPOST_COMMENTARY: 5 } }),
  useNativeRepostEnabled: () => h.state.nativeRepost,
  useMyNativeIntents: (enabled: boolean) => {
    h.state.intentsAskedWith.push(enabled);
    return { data: enabled ? h.state.intents : undefined };
  },
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
  default: ({ campaign, action }: { campaign: { title: string }; action?: ReactNode }) => (
    <article aria-label={campaign.title}>{action}</article>
  ),
  CategoryChip: () => null,
  PriorityChip: () => null,
}));
vi.mock("../components/PostGrid", () => ({
  default: ({
    items,
    categories,
    renderItem,
    note,
  }: {
    items: { id: string }[];
    categories?: unknown[];
    renderItem: (c: { id: string }) => ReactNode;
    note?: ReactNode;
  }) => (
    <section aria-label="post grid" data-categories={categories?.length ?? 0}>
      <p data-testid="grid-note">{note}</p>
      {items.map((c) => (
        <div key={c.id}>{renderItem(c)}</div>
      ))}
    </section>
  ),
}));
vi.mock("../components/PointsTiles", () => ({
  default: ({ historyTo }: { historyTo?: string }) => <div>points tiles → {historyTo}</div>,
}));
vi.mock("../components/OwnPostPanel", () => ({ default: () => <div>own post panel</div> }));
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
vi.mock("../components/NativeRepostActions", () => ({
  default: ({ state, foundPoints, onPostForMe }: { state: string; foundPoints?: number; onPostForMe: () => void }) => (
    <div>
      native: {state} +{foundPoints}
      <button type="button" onClick={onPostForMe}>
        Post it for me
      </button>
    </div>
  ),
}));
vi.mock("../components/ShareDialog", () => ({
  WITH_THOUGHTS_POINTS: 5,
  default: ({ campaign }: { campaign: { title: string } | null }) =>
    campaign ? <div>share dialog: {campaign.title}</div> : null,
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

const share = (campaignId: string, status = "PUBLISHED") => ({
  id: `share-${campaignId}`,
  campaignId,
  status,
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

describe("CelebratePage and own posts", () => {
  it("offers every employee the own-post panel", () => {
    render(<CelebratePage />);
    expect(screen.getByText("own post panel")).toBeTruthy();
  });
});

describe("CelebratePage's tiles and post grid", () => {
  beforeEach(() => {
    h.state.params = new URLSearchParams();
    h.state.campaigns = [campaign("c1", "Launch week"), campaign("c2", "Integrator 5"), campaign("c3", "Old news")];
    h.state.shares = [share("c3")];
    h.state.sharesPending = false;
    h.state.campaignsPending = false;
    h.state.linkStatus = "ACTIVE";
    h.state.mePending = false;
  });

  it("shows the points tiles first, with History linking to My points & Coins", () => {
    render(<CelebratePage />);
    expect(screen.getByText("points tiles → /amplify/my-points")).toBeTruthy();
  });

  it("gives the grid the posts not yet amplified, and the categories for its chips", () => {
    render(<CelebratePage />);
    const grid = screen.getByRole("region", { name: "post grid" });
    expect(grid.getAttribute("data-categories")).toBe("1");
    expect(screen.getByRole("article", { name: "Launch week" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Integrator 5" })).toBeTruthy();
    expect(screen.queryByRole("article", { name: "Old news" })).toBeNull();
  });

  it("opens the share dialog from a card's Post it for me button when LinkedIn is linked", () => {
    render(<CelebratePage />);
    fireEvent.click(within(screen.getByRole("article", { name: "Integrator 5" })).getByRole("button", { name: "Post it for me" }));
    expect(screen.getByText("share dialog: Integrator 5")).toBeTruthy();
  });

  it("asks to link LinkedIn first from a card's Post it for me button when it isn't linked", () => {
    h.state.linkStatus = "NOT_CONNECTED";
    render(<CelebratePage />);
    fireEvent.click(within(screen.getByRole("article", { name: "Launch week" })).getByRole("button", { name: "Post it for me" }));
    expect(screen.getByText(/link dialog: c1 connect/)).toBeTruthy();
    expect(screen.queryByText(/share dialog/)).toBeNull();
  });

  it("says the order and the points over the grid", () => {
    render(<CelebratePage />);
    expect(screen.getByTestId("grid-note").textContent).toBe(
      "Priority first, then newest · Repost +2 · with your thoughts +5",
    );
  });

  it("leaves the grid out once every post is amplified", () => {
    h.state.shares = [share("c1"), share("c2"), share("c3")];
    render(<CelebratePage />);
    expect(screen.queryByRole("region", { name: "post grid" })).toBeNull();
  });
});

describe("CelebratePage and Repost on LinkedIn", () => {
  beforeEach(() => {
    h.state.params = new URLSearchParams();
    h.state.campaigns = [campaign("c1", "Launch week"), campaign("c2", "Integrator 5")];
    h.state.shares = [];
    h.state.linkStatus = "ACTIVE";
    h.state.mePending = false;
    h.state.intents = [];
    h.state.intentsAskedWith = [];
  });

  it("keeps the plain Post it for me button, and asks for no intents, while the setting is off", () => {
    h.state.nativeRepost = false;
    render(<CelebratePage />);
    expect(screen.queryByText(/native:/)).toBeNull();
    expect(h.state.intentsAskedWith.every((enabled) => !enabled)).toBe(true);
  });

  it("gives each card its repost state, with the plain repost points for Found", () => {
    h.state.nativeRepost = true;
    h.state.intents = [{ campaignId: "c2", openedAt: "2026-11-20T10:00:00Z", detectedAt: null, nativeStatus: "LOOKING" }];
    render(<CelebratePage />);
    expect(within(screen.getByRole("article", { name: "Launch week" })).getByText("native: NONE +2")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "Integrator 5" })).getByText("native: LOOKING +2")).toBeTruthy();
  });

  it("still opens the share dialog from Post it for me", () => {
    h.state.nativeRepost = true;
    render(<CelebratePage />);
    fireEvent.click(within(screen.getByRole("article", { name: "Launch week" })).getByRole("button", { name: "Post it for me" }));
    expect(screen.getByText("share dialog: Launch week")).toBeTruthy();
  });
});
