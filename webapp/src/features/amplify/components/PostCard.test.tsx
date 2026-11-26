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
import { fireEvent, render } from "@testing-library/react";
vi.mock("../api/useAmplifyData", () => ({
  useAmplifyConfig: () => ({ linkedinOrgUrn: "urn:li:organization:1", privacyNoticeUrl: "https://example.test/privacy", campaignLinkOrigins: ["https://www.linkedin.com", "https://linkedin.com"] }),
}));

import PostCard from "./PostCard";
import type { Campaign } from "../api/amplifyTypes";

function campaign(imageUrl?: string | null): Campaign {
  return {
    title: "Post",
    summary: "Summary",
    imageUrl,
    categoryCode: "PRODUCT",
    isPriority: false,
    tags: [],
    opensAt: "2026-10-18T00:00:00Z",
    closesAt: "2026-11-18T00:00:00Z",
    status: "LIVE",
    version: 1,
  } as unknown as Campaign;
}

const imgSrc = (c: HTMLElement) => c.querySelector("img")?.getAttribute("src");
const hasDefault = (c: HTMLElement) => c.querySelector("[data-testid=default-post-image]") !== null;

describe("PostCard image", () => {
  it("uses the post's own image", () => {
    const { container } = render(<PostCard campaign={campaign("https://example.com/a.png")} action={null} />);
    expect(imgSrc(container)).toBe("https://example.com/a.png");
  });

  it("falls back to the default when no URL is given", () => {
    const { container } = render(<PostCard campaign={campaign(undefined)} action={null} />);
    expect(hasDefault(container)).toBe(true);
  });

  it("shows the default at 80% size so it has space around it, and a post's own image at full size", () => {
    const own = render(<PostCard campaign={campaign("https://example.com/a.png")} action={null} />);
    const ownImg = own.container.querySelector("img")!;
    expect(getComputedStyle(ownImg).width).toBe("100%");
    own.unmount();
    const { container } = render(<PostCard campaign={campaign(undefined)} action={null} />);
    const logo = container.querySelector("[data-testid=default-post-image]") as SVGElement;
    expect(logo.style.height).toBe("80%");
    expect(logo.style.maxWidth).toBe("80%");
  });

  it("falls back to the default when the URL fails to load", () => {
    const { container } = render(<PostCard campaign={campaign("https://example.com/missing.png")} action={null} />);
    fireEvent.error(container.querySelector("img")!);
    expect(hasDefault(container)).toBe(true);
  });
});
