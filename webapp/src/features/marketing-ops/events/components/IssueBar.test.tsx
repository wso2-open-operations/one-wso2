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


// The issue bar's Job Title actions: translations go through the title dialog, any other
// suggestion on the column keeps accept-all and reject-all.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IssueBar from "./IssueBar";
import type { FieldIssues } from "../lib/issueGroups";

const cell = (row_id: string) => ({ row_id, field: "job_title" });

function renderBar(group: Partial<FieldIssues>) {
  const props = {
    groups: [{ field: "job_title", label: "Job Title", suggested: [], translations: [], blocked: 0, ...group }],
    editable: true,
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onReviewTitles: vi.fn(),
  };
  render(<IssueBar {...props} />);
  return props;
}

describe("IssueBar on Job Title", () => {
  it("opens the title dialog by pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const props = renderBar({ suggested: [cell("r1")], translations: [cell("r1")] });
    const review = screen.getByRole("button", { name: /Go through each title/ });

    await user.click(review);
    review.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(props.onReviewTitles).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("button", { name: /Accept all/ })).toBeNull();
  });

  it("keeps accept-all for suggestions that aren't translations, acting on those only", () => {
    const props = renderBar({ suggested: [cell("r1"), cell("r2")], translations: [cell("r1")] });
    expect(screen.getByRole("button", { name: /Go through each title/ })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Accept all 1 on Job Title" }));
    expect(props.onAccept).toHaveBeenCalledWith([cell("r2")]);
  });

  it("is plain accept-all and reject-all when no suggestion is a translation", () => {
    const props = renderBar({ suggested: [cell("r1")] });
    expect(screen.queryByRole("button", { name: /Go through each title/ })).toBeNull();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Reject all 1 on Job Title" }));
    expect(props.onReject).toHaveBeenCalledWith([cell("r1")]);
  });
});
