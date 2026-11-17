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
import PostLink from "./PostLink";

const access = vi.hoisted(() => ({ hasAccess: true }));
vi.mock("../api/useAmplifyEditorAccess", () => ({
  useAmplifyDashboardAccess: () => ({ hasAccess: access.hasAccess, isResolving: false, retry: () => undefined }),
}));
vi.mock("../pages/dashboards/DashboardPopups", () => ({
  default: ({ view }: { view: { campaignId: string } | null }) => (view ? <div>popup for {view.campaignId}</div> : null),
}));

beforeEach(() => {
  access.hasAccess = true;
});

describe("PostLink", () => {
  it("opens the post popup for a dashboard role", () => {
    render(<PostLink campaignId="c1">Launch</PostLink>);
    fireEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(screen.getByText("popup for c1")).toBeTruthy();
  });

  it("is plain text without the dashboard grant", () => {
    access.hasAccess = false;
    render(<PostLink campaignId="c1">Launch</PostLink>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Launch")).toBeTruthy();
  });
});
