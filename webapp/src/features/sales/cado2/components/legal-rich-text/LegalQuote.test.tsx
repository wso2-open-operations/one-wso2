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

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LegalNotices from "./LegalNotices";
import LegalQuote from "./LegalQuote";

// jsdom lays nothing out: a text is "long" when its height says so.
function heights(scroll: number, client: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scroll);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(client);
}

// Legal texts quoted as they print, long ones as a preview (2026-10-24).
describe("LegalQuote", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens a long text as a preview, with Show full text and Show less", async () => {
    heights(400, 100);
    render(<LegalQuote>Long terms</LegalQuote>);
    const toggle = screen.getByRole("button", { name: "Show full text" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows a short text whole, with no toggle", () => {
    heights(60, 60);
    render(<LegalQuote>Short terms</LegalQuote>);
    expect(screen.getByText("Short terms")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("LegalNotices", () => {
  const notices = [
    { title: "Additional capacity", body: "Capacity text.", showTitle: false, finePrint: false, reason: "" },
    { title: "Security bulletins", body: "Bulletin text.", showTitle: false, finePrint: true, reason: "" },
    { title: "Auto Renewal", body: "Renewal text.", showTitle: true, finePrint: false, reason: "partner deal" },
  ];

  it("prints a title only where Legal says so, and marks what the deal added when asked", () => {
    render(<LegalNotices notices={notices} reasons />);
    expect(screen.queryByText("Additional capacity")).toBeNull();
    expect(screen.getByText("Auto Renewal")).toBeInTheDocument();
    expect(screen.getByText("Partner deal")).toBeInTheDocument();
  });

  it("leaves the markers out on the quote page", () => {
    render(<LegalNotices notices={notices} />);
    expect(screen.queryByText("Partner deal")).toBeNull();
    expect(screen.getByText("Renewal text.")).toBeInTheDocument();
  });
});
