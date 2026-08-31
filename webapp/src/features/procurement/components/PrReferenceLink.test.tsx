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

// The reference is the one thing a user clicks on all three Phase 1 screens, and
// it previously pointed at an in-app route that does not exist — which App.tsx's
// catch-all turned into a silent redirect out of Procurement. These tests pin the
// two things that stop that returning: it must never be an in-app route, and it
// must degrade to plain text rather than to a broken link.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PrReferenceLink from "./PrReferenceLink";

const requestUrl = vi.hoisted(() => vi.fn());

vi.mock("@config/apiConfig", () => ({
  purchasingWebAppRequestUrl: requestUrl,
}));

beforeEach(() => {
  requestUrl.mockReset();
});

describe("PrReferenceLink", () => {
  it("links out to the standalone app in a new tab when it is configured", () => {
    requestUrl.mockReturnValue("https://purchasing.example.com/requests/42");
    render(<PrReferenceLink pr={{ id: 42, reference: "PR-2026-0000042" }} />);

    const link = screen.getByRole("link", { name: /PR-2026-0000042/ });
    expect(link).toHaveAttribute("href", "https://purchasing.example.com/requests/42");
    expect(link).toHaveAttribute("target", "_blank");
    // noreferrer as well as noopener: the tab this opens must not be able to
    // reach back through window.opener.
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("says where the link goes, since the glyph alone says it only to sighted users", () => {
    requestUrl.mockReturnValue("https://purchasing.example.com/requests/42");
    render(<PrReferenceLink pr={{ id: 42, reference: "PR-2026-0000042" }} />);

    expect(
      screen.getByRole("link", { name: "PR-2026-0000042 — opens in the purchasing app" }),
    ).toBeInTheDocument();
  });

  it("renders plain text — never a link — when the standalone app is not configured", () => {
    requestUrl.mockReturnValue(undefined);
    render(<PrReferenceLink pr={{ id: 42, reference: "PR-2026-0000042" }} />);

    expect(screen.getByText("PR-2026-0000042")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("falls back to the system id for a request that predates references", () => {
    requestUrl.mockReturnValue(undefined);
    render(<PrReferenceLink pr={{ id: 42, reference: null }} />);

    expect(screen.getByText("#42")).toBeInTheDocument();
  });

  it("never produces an in-app URL, which the catch-all would redirect away", () => {
    // The regression this file exists for: a relative or /procurement href here
    // resolves against THIS origin, where the detail route is not registered.
    requestUrl.mockReturnValue("https://purchasing.example.com/requests/42");
    render(<PrReferenceLink pr={{ id: 42, reference: "PR-2026-0000042" }} />);

    const href = screen.getByRole("link").getAttribute("href") ?? "";
    expect(href.startsWith("http")).toBe(true);
    expect(href).not.toContain("/procurement/");
  });
});
