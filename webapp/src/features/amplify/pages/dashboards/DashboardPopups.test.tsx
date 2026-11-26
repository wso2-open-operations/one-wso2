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

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DashboardPopups, { type PopupView } from "./DashboardPopups";

const asked = vi.hoisted(() => ({ ids: [] as string[] }));

vi.mock("../../api/useAmplifyDashboards", () => ({
  useDashboardCampaigns: (id?: string) => {
    asked.ids.push(id ?? "");
    return { data: { selected: { campaignId: id }, campaigns: [{ campaignId: id }] }, isPlaceholderData: false };
  },
}));
vi.mock("./CampaignDetailDialog", () => ({
  default: ({ sel, onPerson, onNavigate, onClose }: { sel: { campaignId: string }; onPerson: (p: unknown) => void; onNavigate: (id: string) => void; onClose: () => void }) => (
    <div>
      <span>post {sel.campaignId}</span>
      <button onClick={() => onPerson({ employeeId: "e1", displayName: "Ada" })}>open person</button>
      <button onClick={() => onNavigate("c2")}>next post</button>
      <button onClick={onClose}>close post</button>
    </div>
  ),
}));
vi.mock("./PersonDetailDialog", () => ({
  default: ({ person, onPost, onClose }: { person: { displayName: string }; onPost: (id: string) => void; onClose: () => void }) => (
    <div>
      <span>person {person.displayName}</span>
      <button onClick={() => onPost("c9")}>open post c9</button>
      <button onClick={onClose}>close person</button>
    </div>
  ),
}));

function Harness({ start }: { start: PopupView }) {
  const [view, setView] = useState<PopupView>(start);
  return (
    <>
      <DashboardPopups view={view} onView={setView} />
      <span>{view ? view.kind : "closed"}</span>
    </>
  );
}

describe("DashboardPopups", () => {
  it("renders nothing when nothing is open", () => {
    render(<Harness start={null} />);
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("opens a post, hands a name to the person popup, and a post title back to the post", () => {
    render(<Harness start={{ kind: "post", campaignId: "c1" }} />);
    expect(screen.getByText("post c1")).toBeTruthy();
    fireEvent.click(screen.getByText("open person"));
    expect(screen.getByText("person Ada")).toBeTruthy();
    expect(screen.queryByText("post c1")).toBeNull();
    fireEvent.click(screen.getByText("open post c9"));
    expect(screen.getByText("post c9")).toBeTruthy();
  });

  it("steps to another post under the popup and closes", () => {
    render(<Harness start={{ kind: "post", campaignId: "c1" }} />);
    fireEvent.click(screen.getByText("next post"));
    expect(asked.ids).toContain("c2");
    fireEvent.click(screen.getByText("close post"));
    expect(screen.getByText("closed")).toBeTruthy();
  });
});
