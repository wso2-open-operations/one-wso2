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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mutate = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useRegisterCampaign: () => ({ mutate, isPending: false }) }));
vi.mock("../api/useAmplifyData", () => ({
  useAmplifyCategories: () => ({ data: [{ code: "PRODUCT", label: "Product" }] }),
  useAmplifyConfig: () => ({
    linkedinOrgUrn: "urn:li:organization:1",
    campaignLinkOrigins: ["https://www.linkedin.com", "https://linkedin.com"],
  }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../components/AmplifyShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AmplifyPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/CategoryPicker", () => ({ default: () => <div /> }));

const checkImageUrl = vi.fn();
vi.mock("../util/imageUrlCheck", () => ({ checkImageUrl: (...args: unknown[]) => checkImageUrl(...args) }));

import NewPostPage from "./NewPostPage";

describe("NewPostPage post type and id", () => {
  beforeEach(() => {
    mutate.mockClear();
    checkImageUrl.mockReset();
  });

  const fill = (id: string) => {
    fireEvent.change(screen.getByRole("textbox", { name: /Post ID/ }), { target: { value: id } });
    fireEvent.change(screen.getByLabelText(/Headline/), { target: { value: "Hello" } });
  };
  const save = () => fireEvent.click(screen.getByRole("button", { name: /^Save & share now$/ }));

  it("shows the fixed LinkedIn prefix and registers a share by default", () => {
    render(<NewPostPage />);
    expect(screen.getByText("https://www.linkedin.com/feed/update/")).toBeTruthy();
    fill("7123");
    save();
    const draft = mutate.mock.calls[0][0].draft;
    expect(draft.resourceUrn).toBe("urn:li:share:7123");
    expect(draft.resourceUrl).toBe("https://www.linkedin.com/feed/update/urn:li:share:7123/");
  });

  it("fills the kind and keeps only the id when a whole ugcPost link is pasted", () => {
    render(<NewPostPage />);
    fill("https://www.linkedin.com/feed/update/urn:li:ugcPost:7123/");
    expect((screen.getByRole("textbox", { name: /Post ID/ }) as HTMLInputElement).value).toBe("7123");
    save();
    expect(mutate.mock.calls[0][0].draft.resourceUrn).toBe("urn:li:ugcPost:7123");
  });

  it("does not register without a valid id, or from an activity link", () => {
    render(<NewPostPage />);
    fill("");
    save();
    fill("https://www.linkedin.com/feed/update/urn:li:activity:7123/");
    save();
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("NewPostPage buttons", () => {
  it("has only Save & share now, and it shares", () => {
    render(<NewPostPage />);
    expect(screen.queryByRole("button", { name: /^Save$/ })).toBeNull();
    expect(screen.queryByText(/Saved but not shared/)).toBeNull();
    expect(screen.getAllByRole("button", { name: /Save/ })).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox", { name: /Post ID/ }), { target: { value: "7123" } });
    fireEvent.change(screen.getByLabelText(/Headline/), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save & share now$/ }));
    expect(mutate.mock.calls[0][0].shareNow).toBe(true);
  });
});

describe("NewPostPage image URL check", () => {
  beforeEach(() => checkImageUrl.mockReset());

  const typeImage = (value: string) => {
    const box = screen.getByRole("textbox", { name: /Image URL/ });
    fireEvent.change(box, { target: { value } });
    fireEvent.blur(box);
  };

  it("shows a check and the preview, between headline and summary, when the image is good", async () => {
    checkImageUrl.mockResolvedValue("ok");
    render(<NewPostPage />);
    typeImage("https://media.licdn.com/a.png");
    expect(await screen.findByRole("img", { name: "Image URL is good" })).toBeTruthy();
    const preview = screen.getByAltText("Preview of the post image") as HTMLImageElement;
    expect(preview.src).toBe("https://media.licdn.com/a.png");
    const headline = screen.getByLabelText(/Headline/);
    const summary = screen.getByLabelText(/Card summary/);
    expect(headline.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(preview.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("status").map((n) => n.textContent).join(" ")).toContain("Image URL looks good");
  });

  it("shows the stop sign, the reason and no preview when the image is bad", async () => {
    checkImageUrl.mockResolvedValue({ verdict: "bad", message: "That link didn't load as an image." });
    render(<NewPostPage />);
    typeImage("https://example.com/nope");
    expect(await screen.findByRole("img", { name: "Image URL has a problem" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Image URL is good" })).toBeNull();
    expect(screen.queryByAltText("Preview of the post image")).toBeNull();
    expect(screen.getByText("That link didn't load as an image.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Image URL/ }).getAttribute("aria-invalid")).toBe("true");
  });

  it("shows nothing for an empty box and does not call the checker", () => {
    render(<NewPostPage />);
    typeImage("   ");
    expect(checkImageUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByAltText("Preview of the post image")).toBeNull();
  });

  it("hides the check and preview again when the text changes after a good check", async () => {
    checkImageUrl.mockResolvedValue("ok");
    render(<NewPostPage />);
    typeImage("https://media.licdn.com/a.png");
    await screen.findByAltText("Preview of the post image");
    fireEvent.change(screen.getByRole("textbox", { name: /Image URL/ }), { target: { value: "https://media.licdn.com/b.png" } });
    await waitFor(() => expect(screen.queryByAltText("Preview of the post image")).toBeNull());
    expect(screen.queryByRole("img", { name: "Image URL is good" })).toBeNull();
  });

  it("shows nothing when the checker cannot tell", async () => {
    checkImageUrl.mockResolvedValue("unknown");
    render(<NewPostPage />);
    typeImage("https://media.licdn.com/a.png");
    await waitFor(() => expect(checkImageUrl).toHaveBeenCalled());
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("NewPostPage post ID format check", () => {
  beforeEach(() => mutate.mockClear());
  const box = () => screen.getByRole("textbox", { name: /Post ID/ });
  const blurWith = (value: string) => {
    fireEvent.change(box(), { target: { value } });
    fireEvent.blur(box());
  };

  it("shows a green check on blur for a valid id, worded as format only", async () => {
    render(<NewPostPage />);
    blurWith("7123");
    const tick = await screen.findByRole("img", { name: /Post ID format is valid/ });
    expect(tick.getAttribute("aria-label")).toContain("doesn't confirm the post exists");
    expect(screen.getByText(/Checks the format only/)).toBeTruthy();
  });

  it("shows red text, a stop sign and the reason once, for an id that can't be read", async () => {
    render(<NewPostPage />);
    blurWith("not valid!");
    expect(await screen.findByRole("img", { name: "Post ID format is not valid" })).toBeTruthy();
    // One visible message (the hidden live region repeats it for screen readers).
    expect(screen.getAllByText(/Enter the post's numeric ID/).filter((n) => n.tagName === "P")).toHaveLength(1);
    expect(box().getAttribute("aria-invalid")).toBe("true");
  });

  it("shows nothing for an empty box", () => {
    render(<NewPostPage />);
    blurWith("  ");
    expect(screen.queryByRole("img", { name: /Post ID/ })).toBeNull();
  });

  it("keeps the submit-time error for an empty id, without a competing second message", () => {
    render(<NewPostPage />);
    fireEvent.change(screen.getByLabelText(/Headline/), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save & share now$/ }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Enter the post's numeric ID/)).toHaveLength(1);
  });

  it("re-checks a filled id when the post type changes, and not an empty one", async () => {
    render(<NewPostPage />);
    blurWith("7123");
    await screen.findByRole("img", { name: /Post ID format is valid/ });
    // The check belongs to the share + 7123 pair, so a different type returns the box to idle, then re-checks.
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /Post type/ }));
    fireEvent.click(await screen.findByRole("option", { name: "urn:li:ugcPost" }));
    expect(await screen.findByRole("img", { name: /Post ID format is valid/ })).toBeTruthy();
  });

  it("does not check on a type change while the id is empty", () => {
    render(<NewPostPage />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /Post type/ }));
    fireEvent.click(screen.getByRole("option", { name: "urn:li:ugcPost" }));
    expect(screen.queryByRole("img", { name: /Post ID/ })).toBeNull();
  });

  it("fills the type and the id from a pasted link, then checks it", async () => {
    render(<NewPostPage />);
    fireEvent.change(box(), { target: { value: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7123/" } });
    expect((box() as HTMLInputElement).value).toBe("7123");
    expect(await screen.findByRole("img", { name: /Post ID format is valid/ })).toBeTruthy();
  });

  it("marks a pasted link it can't read as bad on blur", async () => {
    render(<NewPostPage />);
    blurWith("https://www.linkedin.com/feed/update/urn:li:activity:7123/");
    expect(await screen.findByRole("img", { name: "Post ID format is not valid" })).toBeTruthy();
  });
});
