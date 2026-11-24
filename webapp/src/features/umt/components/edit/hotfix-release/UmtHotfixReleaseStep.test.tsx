// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { UmtUpdateBranch, UmtUpdateSummary } from "../../../api/umtUpdates";
import { umtPaths } from "../../../lib/umtPaths";
import UmtHotfixReleaseStep from "./UmtHotfixReleaseStep";

const JOB_URL = "https://jenkins.example.com/job/update-2/job/uat/job/full/job/wso2am/job/wso2am-4.4.0.88-hotfix-x";

const state = vi.hoisted(() => ({
  branches: {} as Record<string, unknown>,
  refetchBranches: vi.fn(),
}));

const useUmtBranches = vi.hoisted(() => vi.fn<(...args: unknown[]) => unknown>(() => state.branches));
vi.mock("../../../api/useUmtBranches", () => ({ useUmtBranches }));

vi.mock("../../../api/useUmtHotfixRelease", () => ({
  useUmtHotfixTestStatus: () => ({ isPending: false, isError: false, data: null, refetch: vi.fn() }),
  useUmtTriggerHotfixTests: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

function update(lifecycleState = "TestingEnvironmentCreated"): UmtUpdateSummary {
  return { id: 42, isHotfix: true, lifecycleState } as UmtUpdateSummary;
}

function loaded(data: UmtUpdateBranch[]) {
  state.branches = { isPending: false, isError: false, data, refetch: state.refetchBranches };
}

function productBranch(overrides: Partial<UmtUpdateBranch> = {}): UmtUpdateBranch {
  return { branchType: "ProductBranch", status: "Completed", jenkinsJobUrl: JOB_URL, ...overrides };
}

function runButton() {
  return screen.getByRole("button", { name: "Run Integration Tests" });
}

beforeEach(() => {
  useUmtBranches.mockClear();
  state.refetchBranches.mockClear();
  window.localStorage.clear();
});

describe("UmtHotfixReleaseStep job URL", () => {
  it("links to the product branch's Jenkins job and allows a run", () => {
    loaded([productBranch()]);
    render(<UmtHotfixReleaseStep id="42" update={update()} />);

    const link = screen.getByRole("link", { name: JOB_URL });
    expect(link).toHaveAttribute("href", JOB_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(runButton()).toBeEnabled();
  });

  it("shows a spinner and blocks a run while the branches load", () => {
    state.branches = { isPending: true, isError: false, data: undefined, refetch: state.refetchBranches };
    render(<UmtHotfixReleaseStep id="42" update={update()} />);

    expect(screen.getByRole("progressbar", { name: "Loading the job URL" })).toBeInTheDocument();
    expect(runButton()).toBeDisabled();
  });

  it.each([
    ["no branches", []],
    ["a product branch that failed", [productBranch({ status: "Failed" })]],
  ])("says the product branch is not created when there are %s", (_label, branches) => {
    loaded(branches);
    render(<UmtHotfixReleaseStep id="42" update={update()} />);

    expect(screen.getByText("Product branch not created")).toBeInTheDocument();
    expect(runButton()).toBeDisabled();
  });

  it("opens the update on its Branch tab to create the product branch", () => {
    loaded([]);
    render(<UmtHotfixReleaseStep id="42" update={update()} />);

    const link = screen.getByRole("link", { name: "The product branch can be created here." });
    expect(link).toHaveAttribute("href", umtPaths.update("42"));
    expect(link).toHaveAttribute("target", "_blank");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(window.localStorage.getItem("one-wso2.umt-update-tab.v1.42")).toBe("branch");
  });

  it("shows N/A for a product branch with no Jenkins job", () => {
    loaded([productBranch({ jenkinsJobUrl: null })]);
    render(<UmtHotfixReleaseStep id="42" update={update()} />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.queryByText("Product branch not created")).not.toBeInTheDocument();
    expect(runButton()).toBeEnabled();
  });

  it("reports a failed branch check with a retry", () => {
    state.branches = {
      isPending: false,
      isError: true,
      error: new Error("boom"),
      data: undefined,
      refetch: state.refetchBranches,
    };
    render(<UmtHotfixReleaseStep id="42" update={update()} />);

    expect(screen.getByText(/Failed to check the status of the product branch/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.refetchBranches).toHaveBeenCalled();
    expect(runButton()).toBeDisabled();
  });

  it("keeps polling the branches until the product branch is completed", () => {
    loaded([]);
    render(<UmtHotfixReleaseStep id="42" update={update()} />);

    const options = useUmtBranches.mock.calls[0][1] as {
      enabled: boolean;
      pollWhile: (branches: UmtUpdateBranch[]) => boolean;
    };
    expect(options.enabled).toBe(true);
    expect(options.pollWhile([])).toBe(true);
    expect(options.pollWhile([productBranch({ status: "Creating" })])).toBe(true);
    expect(options.pollWhile([productBranch()])).toBe(false);
  });

  it.each(["TestingEnvironmentRequested", "TestingEnvironmentFailed"])(
    "does not fetch the branches while the hotfix is %s",
    (lifecycleState) => {
      loaded([]);
      render(<UmtHotfixReleaseStep id="42" update={update(lifecycleState)} />);

      expect(useUmtBranches.mock.calls[0][1]).toMatchObject({ enabled: false });
    },
  );
});
