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
vi.mock("../api/useAmplifyMutations", () => ({ useRequestShare: () => ({ mutate, isPending: false }) }));
vi.mock("../api/useAmplifyData", () => ({
  useAmplifyCategories: () => ({ data: [{ code: "PRODUCT", label: "Product" }] }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

import ShareDialog from "./ShareDialog";
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
  beforeEach(() => mutate.mockClear());

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

  it("caps the text at the API limit", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(thoughts().getAttribute("maxlength")).toBe("3000");
  });
});
