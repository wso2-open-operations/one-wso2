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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ values: undefined as Record<string, number> | undefined }));
vi.mock("../api/useAmplifyData", () => ({ usePointValues: () => ({ data: h.values }) }));
vi.mock("./SubmitOwnPostDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>submit dialog</div> : null),
}));

import OwnPostPanel from "./OwnPostPanel";

describe("OwnPostPanel", () => {
  it("prompts for an own post and opens the dialog", () => {
    render(<OwnPostPanel />);
    expect(screen.getByRole("heading", { name: "Wrote your own post about Choreo Labs?" })).toBeTruthy();
    expect(screen.queryByText("submit dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit your post" }));
    expect(screen.getByText("submit dialog")).toBeTruthy();
  });

  it("states the points at the default rules while the values load, and says the marketing team features posts", () => {
    h.values = undefined;
    render(<OwnPostPanel />);
    expect(screen.getByRole("region", { name: "Your own post" }).textContent).toContain(
      "Submit it for review. Approved posts earn +10, and +15 more if the marketing team features it.",
    );
  });

  it("states the points in force", () => {
    h.values = { OWN_POST: 12, OWN_POST_AMPLIFIED: 30 };
    render(<OwnPostPanel />);
    expect(screen.getByRole("region", { name: "Your own post" }).textContent).toContain("earn +12, and +18 more");
  });

  it("lists no submissions; those show on My points & Coins", () => {
    render(<OwnPostPanel />);
    expect(screen.queryByRole("list")).toBeNull();
  });
});
