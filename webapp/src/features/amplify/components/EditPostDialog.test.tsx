// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
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
import type { Campaign } from "../api/amplifyTypes";

const mutate = vi.fn();
const archive = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({
  useEditCampaign: () => ({ mutate, isPending: false }),
  useArchiveCampaign: () => ({ mutate: archive, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));
vi.mock("../api/useAmplifyData", () => ({
  useAmplifyConfig: () => ({ campaignLinkOrigins: ["https://www.linkedin.com", "https://linkedin.com"] }),
}));
vi.mock("./CategoryPicker", () => ({ default: () => <div /> }));

const checkImageUrl = vi.fn();
vi.mock("../util/imageUrlCheck", () => ({ checkImageUrl: (...args: unknown[]) => checkImageUrl(...args) }));

import EditPostDialog from "./EditPostDialog";

const campaign = {
  id: "c-1",
  resourceUrn: "urn:li:share:7123",
  resourceUrl: "https://www.linkedin.com/feed/update/urn:li:share:7123/",
  title: "Hello",
  summary: "",
  imageUrl: null,
  categoryCode: "PRODUCT",
  isPriority: false,
  closesAt: "2026-12-01T00:00:00Z",
  version: 3,
} as unknown as Campaign;

const patchOf = () => mutate.mock.calls[0][0].patch;
const save = () => fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

describe("EditPostDialog post URL", () => {
  beforeEach(() => mutate.mockClear());

  it("starts with the stored link and sends nothing for it when unchanged", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    expect((screen.getByRole("textbox", { name: /Post URL/ }) as HTMLInputElement).value).toBe(campaign.resourceUrl);
    save();
    expect(patchOf().resourceUrl).toBeUndefined();
  });

  it("sends the edited link trimmed", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Post URL/ }), { target: { value: "  https://www.linkedin.com/posts/x  " } });
    save();
    expect(patchOf().resourceUrl).toBe("https://www.linkedin.com/posts/x");
  });

  it("sends a blank string to clear the link", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Post URL/ }), { target: { value: "" } });
    save();
    expect(patchOf().resourceUrl).toBe("");
  });
});

describe("EditPostDialog delete", () => {
  beforeEach(() => archive.mockReset());

  const openConfirm = (onClose = vi.fn()) => {
    render(<EditPostDialog campaign={campaign} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    return onClose;
  };

  it("opens the delete confirmation from the footer Delete button", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    expect(screen.queryByText(/Please confirm delete of/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Please confirm delete of: Hello")).toBeTruthy();
  });

  it("Cancel hides the confirmation and leaves Update post open", () => {
    const onClose = openConfirm();
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" }).at(-1)!);
    expect(screen.queryByText(/Please confirm delete of/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes Update post after a successful delete", () => {
    archive.mockImplementation((_v, opts) => opts?.onSuccess());
    const onClose = openConfirm();
    fireEvent.change(screen.getByPlaceholderText("delete"), { target: { value: "delete" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(archive.mock.calls[0][0]).toEqual({ id: "c-1" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("EditPostDialog image URL check", () => {
  const withImage = { ...campaign, imageUrl: "https://media.licdn.com/a.png" } as Campaign;
  beforeEach(() => checkImageUrl.mockReset());

  it("checks the stored image when the dialog opens and shows the preview between headline and summary", async () => {
    checkImageUrl.mockResolvedValue("ok");
    render(<EditPostDialog campaign={withImage} onClose={vi.fn()} />);
    expect(checkImageUrl).toHaveBeenCalledWith("https://media.licdn.com/a.png", expect.anything());
    const preview = (await screen.findByAltText("Preview of the post image")) as HTMLImageElement;
    expect(preview.src).toBe("https://media.licdn.com/a.png");
    expect(screen.getByRole("img", { name: "Image URL is good" })).toBeTruthy();
    const headline = screen.getByLabelText(/Headline/);
    const summary = screen.getByLabelText(/Card summary/);
    expect(headline.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(preview.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks a bad stored image and shows no preview", async () => {
    checkImageUrl.mockResolvedValue("bad");
    render(<EditPostDialog campaign={withImage} onClose={vi.fn()} />);
    expect(await screen.findByRole("img", { name: "Image URL has a problem" })).toBeTruthy();
    expect(screen.queryByAltText("Preview of the post image")).toBeNull();
  });

  it("checks nothing on open when there is no image, and checks an edited value on blur", async () => {
    checkImageUrl.mockResolvedValue("ok");
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    expect(checkImageUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole("img", { name: /Image URL/ })).toBeNull();
    const box = screen.getByRole("textbox", { name: /Image URL/ });
    fireEvent.change(box, { target: { value: "https://media.licdn.com/c.png" } });
    fireEvent.blur(box);
    expect(await screen.findByAltText("Preview of the post image")).toBeTruthy();
  });

  it("still sends the image URL on save", () => {
    checkImageUrl.mockResolvedValue("ok");
    mutate.mockClear();
    render(<EditPostDialog campaign={withImage} onClose={vi.fn()} />);
    save();
    expect(patchOf().imageUrl).toBe("https://media.licdn.com/a.png");
  });
});

describe("EditPostDialog post URL format check", () => {
  beforeEach(() => checkImageUrl.mockReset());
  const box = () => screen.getByRole("textbox", { name: /Post URL/ });

  it("marks the stored link as a valid format when the dialog opens, without claiming it exists", async () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    const tick = await screen.findByRole("img", { name: /Post URL format is valid/ });
    expect(tick.getAttribute("aria-label")).toContain("doesn't confirm the post exists");
    expect(checkImageUrl).not.toHaveBeenCalled();
  });

  it("flags a link on another site with a reason, on blur", async () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    await screen.findByRole("img", { name: /Post URL format is valid/ });
    fireEvent.change(box(), { target: { value: "https://example.com/x" } });
    fireEvent.blur(box());
    expect(await screen.findByRole("img", { name: "Post URL format is not valid" })).toBeTruthy();
    expect(screen.getAllByText(/Use a link on linkedin.com/).some((n) => n.tagName === "P")).toBe(true);
    expect(box().getAttribute("aria-invalid")).toBe("true");
  });

  it("shows nothing for a blank link (blank clears it)", () => {
    render(<EditPostDialog campaign={{ ...campaign, resourceUrl: "" } as Campaign} onClose={vi.fn()} />);
    fireEvent.change(box(), { target: { value: "  " } });
    fireEvent.blur(box());
    expect(screen.queryByRole("img", { name: /Post URL/ })).toBeNull();
  });
});
