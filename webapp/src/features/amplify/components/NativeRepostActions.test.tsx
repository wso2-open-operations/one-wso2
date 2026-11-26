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

const h = vi.hoisted(() => ({ mutate: vi.fn(), showError: vi.fn() }));
vi.mock("../api/useAmplifyMutations", () => ({ useRecordNativeIntent: () => ({ mutate: h.mutate, isPending: false }) }));
vi.mock("../api/useAmplifyData", () => ({
  useAmplifyConfig: () => ({ linkedinOrgUrn: "", privacyNoticeUrl: "", campaignLinkOrigins: ["https://www.linkedin.com"] }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: h.showError, showSuccess: vi.fn() }),
}));

import { HttpError } from "@api/http";
import NativeRepostActions from "./NativeRepostActions";

const campaign = { id: "c-1", resourceUrn: "urn:li:share:7", resourceUrl: null };
const POST_URL = "https://www.linkedin.com/feed/update/urn:li:share:7/";

describe("NativeRepostActions", () => {
  let open: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    h.mutate.mockReset();
    h.showError.mockReset();
    open = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("offers Repost on LinkedIn above Post it for me before the post is opened", () => {
    const onPostForMe = vi.fn();
    render(<NativeRepostActions campaign={campaign} state="NONE" onPostForMe={onPostForMe} />);
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Repost on LinkedIn", "Post it for me"]);
    fireEvent.click(screen.getByRole("button", { name: "Post it for me" }));
    expect(onPostForMe).toHaveBeenCalledTimes(1);
  });

  it("opens the post on LinkedIn in a new tab and records the click", () => {
    render(<NativeRepostActions campaign={campaign} state="NONE" onPostForMe={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Repost on LinkedIn" }));
    expect(open).toHaveBeenCalledWith(POST_URL, "_blank", "noopener,noreferrer");
    expect(h.mutate.mock.calls[0][0]).toEqual({ campaignId: "c-1" });
  });

  it("says why when the click couldn't be recorded", () => {
    h.mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new HttpError("/x", 404, JSON.stringify({ status: 404, code: "CAMPAIGN_CLOSED" }))),
    );
    render(<NativeRepostActions campaign={campaign} state="NONE" onPostForMe={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Repost on LinkedIn" }));
    expect(h.showError).toHaveBeenCalledWith("This post isn't open for sharing anymore.");
  });

  it("says it is looking for the repost, with a link to open LinkedIn again and no Post it for me", () => {
    render(<NativeRepostActions campaign={campaign} state="LOOKING" onPostForMe={() => {}} />);
    expect(screen.getByRole("status").textContent).toBe(
      "Looking for your repostWe count it within 24 hours. Didn't repost? Open LinkedIn again",
    );
    expect(screen.queryByRole("button", { name: "Post it for me" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open LinkedIn again" }));
    expect(open).toHaveBeenCalledWith(POST_URL, "_blank", "noopener,noreferrer");
    expect(h.mutate).toHaveBeenCalledTimes(1);
  });

  it("says it found the repost, with its points", () => {
    render(<NativeRepostActions campaign={campaign} state="DETECTED" foundPoints={2} onPostForMe={() => {}} />);
    expect(screen.getByText("Found your repost · +2")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("after 24 hours offers to open LinkedIn again or let Amplify post it", () => {
    const onPostForMe = vi.fn();
    render(<NativeRepostActions campaign={campaign} state="NOT_FOUND" onPostForMe={onPostForMe} />);
    expect(screen.getByText("We couldn't find your repost")).toBeTruthy();
    expect(screen.getByText("It's been 24 hours. Try once more, or let Amplify post it.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Post it for me" }));
    expect(onPostForMe).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open LinkedIn again" }));
    expect(h.mutate).toHaveBeenCalledTimes(1);
  });
});
