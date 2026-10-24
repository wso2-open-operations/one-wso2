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

// The Release button's gate: a chunk goes out only when every update level
// has built successfully, and a build status that could not be read is not
// consent to release it.
//
// These live in their own file because each case needs different mocked row
// statuses, and the grid reads those through a module-level vi.mock.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({
  chunkStatus: "created",
  buildStatus: undefined as unknown,
  freshBuildStatus: undefined as unknown,
  fetchFresh: undefined as undefined | (() => Promise<unknown>),
  showWarning: vi.fn(),
  releaseMutate: vi.fn(async () => undefined),
}));

const CHUNK = {
  id: 42,
  updateIds: [101],
  updateLevels: [{ productName: "wso2am", productVersion: "4.2.0", buildStatus: "SUCCESS" }],
};

vi.mock("../../api/useUmtGate", () => ({
  useUmtGate: () => ({
    isAuthorized: true,
    isUser: true,
    isAdmin: true,
    isProductLead: false,
    hasRole: () => true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

vi.mock("../../api/useUmtReleaseChunks", () => ({
  useUmtReleaseChunks: () => ({
    data: { chunks: [CHUNK], totalCount: 1 },
    isError: false,
    isFetching: false,
    isPending: false,
    error: null,
    refetch: () => {},
  }),
  useFetchFreshUmtReleaseChunkBuildStatus: () => async () =>
    state.fetchFresh ? state.fetchFresh() : state.freshBuildStatus,
  useUmtReleaseChunkRowStatuses: () => ({
    42: {
      buildStatusLoading: false,
      buildStatus: state.buildStatus,
      chunkStatus: { id: 42, updateIds: [101], status: state.chunkStatus },
    },
  }),
  useUmtReleaseChunkDockerBuildStatus: () => ({
    data: [],
    isError: false,
    isFetching: false,
    isPending: false,
    error: null,
    refetch: () => {},
  }),
}));

const idleMutation = () => ({ isPending: false, mutateAsync: async () => undefined });

vi.mock("../../api/useUmtReleaseChunkActions", () => ({
  useUmtTriggerProductBuild: idleMutation,
  useUmtTriggerTgBuild: idleMutation,
  useUmtTriggerReleaseChunkBuilds: idleMutation,
  useUmtRetriggerCstBuild: idleMutation,
  useUmtRetriggerDockerBuild: idleMutation,
  useUmtReleaseChunk: () => ({ isPending: false, mutateAsync: state.releaseMutate }),
  useUmtSendReleaseChunkEmail: idleMutation,
  useUmtRemoveReleaseChunk: idleMutation,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: state.showWarning,
  }),
}));

const { default: UmtPendingReleaseChunksGrid } = await import("./UmtPendingReleaseChunksGrid");

async function clickRelease() {
  await userEvent.click(screen.getByRole("button", { name: "Release" }));
}

describe("UmtPendingReleaseChunksGrid release gate", () => {
  beforeEach(() => {
    state.showWarning.mockClear();
    state.releaseMutate.mockClear();
    state.fetchFresh = undefined;
    state.chunkStatus = "created";
  });

  it("shows progress, and no Release, for a chunk whose release was requested", () => {
    state.chunkStatus = "requestedToRelease";
    render(<UmtPendingReleaseChunksGrid />);

    expect(screen.getByText("Releasing chunks…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
  });

  it("shows progress, and no Release, for a chunk whose creation was requested", () => {
    state.chunkStatus = "requestedToCreate";
    render(<UmtPendingReleaseChunksGrid />);

    expect(screen.getByText("Creating chunk…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
  });

  it("refuses to release a chunk whose build status could not be fetched", async () => {
    // The trap: the levels list read off a missing status is empty, and
    // `[].every(...)` is true — so without its own case an unfetched status
    // reads as "every level succeeded" and opens the release dialog.
    state.buildStatus = state.freshBuildStatus = undefined;
    render(<UmtPendingReleaseChunksGrid />);

    await clickRelease();

    await waitFor(() =>
      expect(state.showWarning).toHaveBeenCalledWith(expect.stringContaining("unavailable")),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("warns about integration test failures when a level has not succeeded", async () => {
    state.buildStatus = state.freshBuildStatus = {
      id: 42,
      updateIds: [101],
      updateLevels: [{ buildStatus: "SUCCESS" }, { buildStatus: "UNSTABLE" }],
    };
    render(<UmtPendingReleaseChunksGrid />);

    await clickRelease();

    await waitFor(() =>
      expect(state.showWarning).toHaveBeenCalledWith(
        expect.stringContaining("integration test failures"),
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the release dialog when every level succeeded", async () => {
    state.buildStatus = state.freshBuildStatus = {
      id: 42,
      updateIds: [101],
      updateLevels: [{ buildStatus: "SUCCESS" }, { buildStatus: "SUCCESS" }],
    };
    render(<UmtPendingReleaseChunksGrid />);

    await clickRelease();

    expect(state.showWarning).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toHaveTextContent("Proceed and Release");
  });

  it("decides on the build status fetched at click time, not the one the row loaded", async () => {
    // The row loaded while every level had succeeded; a level has since been
    // rebuilt and failed.
    state.buildStatus = {
      id: 42,
      updateIds: [101],
      updateLevels: [{ buildStatus: "SUCCESS" }],
    };
    state.freshBuildStatus = {
      id: 42,
      updateIds: [101],
      updateLevels: [{ buildStatus: "FAILURE" }],
    };
    render(<UmtPendingReleaseChunksGrid />);

    await clickRelease();

    await waitFor(() =>
      expect(state.showWarning).toHaveBeenCalledWith(
        expect.stringContaining("integration test failures"),
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a spinner on Release, and holds it, until the check answers", async () => {
    let resolveCheck: (status: unknown) => void = () => {};
    state.fetchFresh = () =>
      new Promise((resolve) => {
        resolveCheck = resolve;
      });
    render(<UmtPendingReleaseChunksGrid />);

    await clickRelease();

    expect(screen.getByRole("button", { name: "Release" })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    resolveCheck({ id: 42, updateIds: [101], updateLevels: [{ buildStatus: "SUCCESS" }] });

    expect(await screen.findByRole("dialog")).toHaveTextContent("Proceed and Release");
    // The open dialog hides the grid behind it from the accessibility tree.
    expect(screen.getByRole("button", { name: "Release", hidden: true })).toBeEnabled();
  });

  it("ignores a Release check that finishes after another action was asked for", async () => {
    // The check is slow; meanwhile the status email is asked for. The check
    // then answers with every level succeeded, which must not open the
    // release dialog over the email one.
    let resolveCheck: (status: unknown) => void = () => {};
    state.fetchFresh = () =>
      new Promise((resolve) => {
        resolveCheck = resolve;
      });
    render(<UmtPendingReleaseChunksGrid />);

    await clickRelease();
    await userEvent.click(screen.getByRole("button", { name: "Send status email" }));
    const dialog = await screen.findByRole("dialog");

    resolveCheck({ id: 42, updateIds: [101], updateLevels: [{ buildStatus: "SUCCESS" }] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Release", hidden: true })).toBeEnabled());

    expect(dialog).not.toHaveTextContent("Proceed and Release");
    expect(state.showWarning).not.toHaveBeenCalled();
  });

  // The release dialog can stay open a while after the check that opened it.
  describe("when the release is confirmed", () => {
    const succeeded = { id: 42, updateIds: [101], updateLevels: [{ buildStatus: "SUCCESS" }] };
    const failed = { id: 42, updateIds: [101], updateLevels: [{ buildStatus: "SUCCESS" }, { buildStatus: "FAILURE" }] };
    const confirm = () => userEvent.click(screen.getByRole("button", { name: "Proceed and Release" }));

    // Answers the first check, which opens the dialog, then the given statuses.
    function checksAnswering(...later: unknown[]) {
      const answers = [succeeded, ...later];
      const calls = vi.fn(async () => answers[Math.min(calls.mock.calls.length - 1, answers.length - 1)]);
      state.fetchFresh = calls;
      return calls;
    }

    it("checks the build status again, and releases when every level has still succeeded", async () => {
      const checks = checksAnswering(succeeded);
      render(<UmtPendingReleaseChunksGrid />);
      await clickRelease();
      await screen.findByRole("dialog");

      await confirm();

      await waitFor(() => expect(state.releaseMutate).toHaveBeenCalledTimes(1));
      expect(checks).toHaveBeenCalledTimes(2);
    });

    it("does not release when a level has failed since the dialog opened, and says so", async () => {
      checksAnswering(failed);
      render(<UmtPendingReleaseChunksGrid />);
      await clickRelease();
      await screen.findByRole("dialog");

      await confirm();

      await waitFor(() =>
        expect(state.showWarning).toHaveBeenCalledWith(expect.stringContaining("integration test failures")),
      );
      expect(state.releaseMutate).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("does not release when the build status can no longer be read", async () => {
      checksAnswering(undefined);
      render(<UmtPendingReleaseChunksGrid />);
      await clickRelease();
      await screen.findByRole("dialog");

      await confirm();

      await waitFor(() => expect(state.showWarning).toHaveBeenCalledWith(expect.stringContaining("unavailable")));
      expect(state.releaseMutate).not.toHaveBeenCalled();
    });
  });
});
