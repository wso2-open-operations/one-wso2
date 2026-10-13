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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { UmtUpdateSummary } from "../../../api/umtUpdates";

const proceedMutateAsync = vi.fn(async () => undefined);

vi.mock("../../../api/useUmtPrAnalysis", () => ({
  UmtPartialProceedError: class extends Error {},
  useUmtPrAnalysisStatus: () => ({ data: "COMPLETED" }),
  useUmtStartPullRequestAnalysis: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUmtProceedFromPrAnalysis: () => ({ isPending: false, mutateAsync: proceedMutateAsync }),
}));

// A completed General analysis with a manually added file, which would make
// General's Proceed open the "Added and Modified Files" warning.
vi.mock("../../../api/useUmtUpdateViewData", () => ({
  useUmtPullRequestAnalysis: () => ({
    data: { additionalFileOperations: [{ operation: "Added", file: "/lib/extra.jar" }] },
  }),
}));

vi.mock("./UmtPrAnalysisResults", () => ({ default: () => <div>PR analysis results</div> }));
vi.mock("./UmtAddManualFilesSection", () => ({ default: () => null }));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const { default: UmtPrAnalysisStep } = await import("./UmtPrAnalysisStep");

const UPDATE = { lifecycleState: "Development", praStatus: "COMPLETED" } as UmtUpdateSummary;

describe("UmtPrAnalysisStep", () => {
  it("proceeds an Instructions Only update straight away, without Analyze, results or the files warning", () => {
    render(<UmtPrAnalysisStep id="42" update={UPDATE} />);

    fireEvent.click(screen.getByLabelText("Instructions Only Update"));

    expect(screen.queryByRole("button", { name: "Analyze" })).toBeNull();
    expect(screen.queryByText("PR analysis results")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Proceed" }));

    expect(screen.queryByText("Added and Modified Files")).toBeNull();
    expect(proceedMutateAsync).toHaveBeenCalledWith({ isInstructionsOnly: true });
  });
});
