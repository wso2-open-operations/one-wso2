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
import { HttpError } from "@api/http";

const mutate = vi.fn();
const mentionQueries: string[] = [];
const showSuccess = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useRequestShare: () => ({ mutate, isPending: false }) }));
vi.mock("../api/useAmplifyData", () => ({
  useAmplifyCategories: () => ({ data: [{ code: "PRODUCT", label: "Product" }] }),
  MENTION_DEBOUNCE_MS: 10,
  useMentionCandidates: (q: string) => {
    if (q) mentionQueries.push(q);
    return {
      // "Zed" finds nobody, like a name that isn't a linked colleague.
      data: q && !q.startsWith("Zed")
        ? [
            { ref: "person:e-1", kind: "PERSON", displayName: "Jane Smith" },
            { ref: "org:wso2", kind: "ORGANIZATION", displayName: "Chore Labs" },
          ]
        : undefined,
    };
  },
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
    mentionQueries.length = 0;
    showSuccess.mockClear();
  });

  it("asks for a REPOST of the post, not a new post that links to it", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ campaignId: "c-1", kind: "REPOST" });
  });

  const thoughts = () => screen.getByLabelText(/Add your thoughts/);

  it("shows the post as its card (title, priority and category chips) above the thoughts box", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(screen.getByText("Amplify this post")).toBeTruthy();
    expect(screen.getByText("WSO2 Integrator 5.0 is here")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByText("Product")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Amplify" })).toHaveLength(1);
  });

  it("sends REPOST_COMMENTARY with the trimmed text when the employee adds thoughts", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "  Proud of this team  " } });
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(mutate.mock.calls[0][0]).toEqual({
      campaignId: "c-1",
      kind: "REPOST_COMMENTARY",
      commentary: "Proud of this team",
    });
  });

  it("stays a plain REPOST when the thoughts are only whitespace", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(mutate.mock.calls[0][0]).toEqual({ campaignId: "c-1", kind: "REPOST" });
  });

  const amplifyButton = () => screen.getByRole("button", { name: "Amplify" }) as HTMLButtonElement;
  const box = () => thoughts() as HTMLTextAreaElement;

  it("says the share is queued and may take a while, since shares go out one at a time", () => {
    mutate.mockImplementation((_body, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(showSuccess).toHaveBeenCalledWith(SHARE_QUEUED_MESSAGE);
    expect(SHARE_QUEUED_MESSAGE).toMatch(/one at a time/);
  });

  it("wraps the selection in ** when Bold is pressed", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "hello world" } });
    box().setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(box().value).toBe("**hello** world");
  });

  it("formats with Ctrl+B and Ctrl+I, and undoes with Ctrl+Z", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "big" } });
    box().setSelectionRange(0, 3);
    fireEvent.keyDown(thoughts(), { key: "b", ctrlKey: true });
    expect(box().value).toBe("**big**");
    box().setSelectionRange(2, 5);
    fireEvent.keyDown(thoughts(), { key: "i", metaKey: true });
    expect(box().value).toBe("***big***");
    fireEvent.keyDown(thoughts(), { key: "z", ctrlKey: true });
    expect(box().value).toBe("**big**");
    fireEvent.keyDown(thoughts(), { key: "z", ctrlKey: true, shiftKey: true });
    expect(box().value).toBe("***big***");
  });

  it("prefixes lines for lists and quotes", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "one\ntwo" } });
    box().setSelectionRange(0, 7);
    fireEvent.click(screen.getByRole("button", { name: "Numbered list" }));
    expect(box().value).toBe("1. one\n2. two");
  });

  it("labels every toolbar button", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    for (const name of ["Bold", "Italic", "Strikethrough", "Link", "Bulleted list", "Numbered list", "Quote", "Code", "Undo", "Redo"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("counts the LinkedIn text, not the markdown, and shows the preview", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "**ab** #wso2" } });
    // Two bold letters are two UTF-16 units each: 4 + " #wso2" (6).
    expect(screen.getByText("10 / 3000")).toBeTruthy();
    const preview = screen.getByRole("region", { name: "LinkedIn preview" });
    expect(preview.getAttribute("aria-live")).toBe("polite");
    expect(preview.textContent).toBe("𝗮𝗯 #wso2");
  });

  it("sends the converted text", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "- **Go** team" } });
    fireEvent.click(amplifyButton());
    expect(mutate.mock.calls[0][0].commentary).toBe("● 𝗚𝗼 team");
  });

  it("disables Amplify over the limit", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "a".repeat(3001) } });
    expect(screen.getByText(/3001 \/ 3000/)).toBeTruthy();
    expect(amplifyButton().disabled).toBe(true);
    fireEvent.change(thoughts(), { target: { value: "a".repeat(3000) } });
    expect(amplifyButton().disabled).toBe(false);
  });

  it("inserts a picked mention and sends it as a token", async () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "Thanks @Ja" } });
    const option = await screen.findByRole("option", { name: /Jane Smith/ });
    expect(mentionQueries).toContain("Ja");
    fireEvent.click(option);
    expect(box().value).toBe("Thanks @Jane Smith ");
    expect(screen.getByRole("region", { name: "LinkedIn preview" }).textContent).toBe("Thanks Jane Smith");
    fireEvent.click(amplifyButton());
    expect(mutate.mock.calls[0][0]).toEqual({
      campaignId: "c-1",
      kind: "REPOST_COMMENTARY",
      commentary: "Thanks @[Jane Smith](amplify:person:e-1)",
    });
  });

  it("picks a mention with the keyboard and never shows a ref", async () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "@ch" } });
    await screen.findByRole("listbox");
    expect(screen.queryByText(/person:e-1|org:wso2/)).toBeNull();
    fireEvent.keyDown(thoughts(), { key: "ArrowDown" });
    const opts = screen.getAllByRole("option");
    expect(opts[1].getAttribute("aria-selected")).toBe("true");
    expect(thoughts().getAttribute("aria-activedescendant")).toBe(opts[1].id);
    fireEvent.keyDown(thoughts(), { key: "Enter" });
    expect(box().value).toBe("@Chore Labs ");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("closes the list on Escape", async () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "@ja" } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(thoughts(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(box().value).toBe("@ja");
  });

  it("never picks from results for an older query", async () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "@Ja" } });
    await screen.findByRole("listbox");
    // Typed on: the results were for "Ja", so the list hides until the new query's results are in.
    fireEvent.change(thoughts(), { target: { value: "@Jab" } });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(thoughts(), { key: "Enter" });
    expect(box().value).toBe("@Jab");
    await screen.findByRole("listbox");
  });

  it("lets a name be typed without a pick and sends it as plain text", async () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "Thanks @Zed" } });
    await waitFor(() => expect(mentionQueries).toContain("Zed"));
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(thoughts(), { key: "Enter" });
    fireEvent.keyDown(thoughts(), { key: "Tab" });
    expect(box().value).toBe("Thanks @Zed");
    fireEvent.click(amplifyButton());
    expect(mutate.mock.calls[0][0].commentary).toBe("Thanks @Zed");
  });

  it("does not force a pick when the list is open", async () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "@Ja" } });
    await screen.findByRole("listbox");
    fireEvent.change(thoughts(), { target: { value: "@Ja rocks" } });
    fireEvent.click(amplifyButton());
    expect(mutate.mock.calls[0][0].commentary).toBe("@Ja rocks");
  });

  it("previews only word-start hashtags, as LinkedIn will get them", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "Go #team and C#sharp and #a_b" } });
    const preview = screen.getByRole("region", { name: "LinkedIn preview" });
    const marked = Array.from(preview.querySelectorAll('[data-kind="hashtag"]')).map((n) => n.textContent);
    expect(marked).toEqual(["#team", "#a"]);
    expect(preview.textContent).toBe("Go #team and C#sharp and #a_b");
  });

  it("drops a mention whose name was edited", async () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "@Ja" } });
    fireEvent.click(await screen.findByRole("option", { name: /Jane Smith/ }));
    fireEvent.change(thoughts(), { target: { value: "@Jane Smit" } });
    fireEvent.click(amplifyButton());
    expect(mutate.mock.calls[0][0].commentary).toBe("@Jane Smit");
  });

  it("hands a broken LinkedIn link to the page instead of showing an error", () => {
    const onNeedsReconnect = vi.fn();
    mutate.mockImplementation((_vars, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new HttpError("/shares", 409, JSON.stringify({ code: "CONNECTION_NEEDS_RECONNECT" }))),
    );
    render(<ShareDialog campaign={campaign} onClose={() => {}} onNeedsReconnect={onNeedsReconnect} />);
    fireEvent.click(amplifyButton());
    expect(onNeedsReconnect).toHaveBeenCalledWith(campaign);
  });
});
