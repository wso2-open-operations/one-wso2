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

import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import PostCard, { DEFAULT_POST_IMAGE } from "./PostCard";
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

describe("PostCard image", () => {
  it("uses the post's own image", () => {
    const { container } = render(<PostCard campaign={campaign("https://example.com/a.png")} action={null} />);
    expect(imgSrc(container)).toBe("https://example.com/a.png");
  });

  it("falls back to the default when no URL is given", () => {
    const { container } = render(<PostCard campaign={campaign(undefined)} action={null} />);
    expect(imgSrc(container)).toBe(DEFAULT_POST_IMAGE);
  });

  it("falls back to the default when the URL fails to load", () => {
    const { container } = render(<PostCard campaign={campaign("https://example.com/missing.png")} action={null} />);
    fireEvent.error(container.querySelector("img")!);
    expect(imgSrc(container)).toBe(DEFAULT_POST_IMAGE);
  });
});
