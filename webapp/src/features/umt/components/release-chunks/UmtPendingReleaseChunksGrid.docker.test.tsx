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

// A chunk whose docker builds failed: the row action it offers, the Build
// Information dialog behind it, and the retrigger that both lead to.
//
// These live in their own file because they need the chunk in a different
// lifecycle status than the other grid tests, and the grid reads that through
// a module-level vi.mock.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = vi.hoisted(() => ({
  chunkStatus: "releasingDockerFailed",
  dockerMutate: vi.fn(async () => ({ statusRefreshed: true })),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showError: vi.fn(),
}));

const CHUNK = {
  id: 42,
  updateIds: [101],
  updateLevels: [{ productName: "wso2am", productVersion: "4.2.0", buildStatus: "SUCCESS" }],
};

const FAILED_REASON = "Docker image push failed for wso2am-4.2.0";

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
    data: [CHUNK],
    isError: false,
    isFetching: false,
    isPending: false,
    error: null,
    refetch: () => {},
  }),
  useUmtReleaseChunkRowStatuses: () => ({
    42: {
      buildStatusLoading: false,
      buildStatus: undefined,
      chunkStatus: { id: 42, updateIds: [101], status: state.chunkStatus, failedReason: FAILED_REASON },
    },
  }),
  useUmtReleaseChunkDockerBuildStatus: () => ({
    data: [
      { productName: "wso2am", productVersion: "4.2.0", buildStatus: "UNSTABLE" },
      { productName: "wso2is", productVersion: "7.0.0", buildStatus: "SUCCESS" },
    ],
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
  useUmtTriggerCstBuild: idleMutation,
  useUmtRetriggerDockerBuild: () => ({ isPending: false, mutateAsync: state.dockerMutate }),
  useUmtReleaseChunk: idleMutation,
  useUmtSendReleaseChunkEmail: idleMutation,
  useUmtRemoveReleaseChunk: idleMutation,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    showSuccess: state.showSuccess,
    showError: state.showError,
    showWarning: state.showWarning,
  }),
}));

const { default: UmtPendingReleaseChunksGrid } = await import("./UmtPendingReleaseChunksGrid");
const { default: UmtDockerRetriggerIcon } = await import("./UmtDockerRetriggerIcon");

function actionLines(): HTMLElement[] {
  const cell = document.querySelector('.MuiDataGrid-cell[data-field="actions"]');
  if (!cell?.firstElementChild) throw new Error("no actions cell rendered");
  return [...cell.firstElementChild.children] as HTMLElement[];
}

function buildInfoDialog(): HTMLElement {
  return screen.getByRole("dialog", { name: /Build Information/ });
}

async function confirmRetrigger() {
  const confirm = await screen.findByRole("dialog", { name: "Retrigger Docker Builds" });
  expect(confirm).toHaveTextContent(
    "Are you sure you want to retrigger failed Docker builds for release chunk ID: 42?",
  );
  await userEvent.click(within(confirm).getByRole("button", { name: "Confirm" }));
}

describe("UmtPendingReleaseChunksGrid docker retrigger", () => {
  beforeEach(() => {
    state.chunkStatus = "releasingDockerFailed";
    state.dockerMutate.mockReset();
    state.dockerMutate.mockResolvedValue({ statusRefreshed: true });
    state.showSuccess.mockClear();
    state.showWarning.mockClear();
    state.showError.mockClear();
  });

  it("stacks the retrigger button, the failure reason and See build info, one per line", () => {
    render(<UmtPendingReleaseChunksGrid />);

    const [retrigger, reason, buildInfo, ...rest] = actionLines();
    expect(rest).toHaveLength(0);
    expect(within(retrigger).getByRole("button", { name: "Retrigger Docker build" })).toBeInTheDocument();
    expect(reason).toHaveTextContent(FAILED_REASON);
    expect(reason).not.toHaveTextContent("Releasing release chunk Failed");
    expect(within(buildInfo).getByRole("button", { name: "See build info" })).toBeInTheDocument();
  });

  it("retriggers from the row only after confirmation", async () => {
    render(<UmtPendingReleaseChunksGrid />);

    await userEvent.click(screen.getByRole("button", { name: "Retrigger Docker build" }));
    expect(state.dockerMutate).not.toHaveBeenCalled();
    await confirmRetrigger();

    await waitFor(() => expect(state.dockerMutate).toHaveBeenCalledTimes(1));
    expect(state.showSuccess).toHaveBeenCalledWith("Docker builds retriggered successfully.");
  });

  it("lists each product's docker build status in Build Information", async () => {
    render(<UmtPendingReleaseChunksGrid />);

    await userEvent.click(screen.getByRole("button", { name: "See build info" }));

    const dialog = buildInfoDialog();
    const rows = within(dialog).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "wso2am-4.2.0Unstable",
      "wso2is-7.0.0Successful",
    ]);
  });

  it("does not offer sorting on the Build Information table", async () => {
    render(<UmtPendingReleaseChunksGrid />);

    await userEvent.click(screen.getByRole("button", { name: "See build info" }));

    const headers = within(buildInfoDialog()).getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header).not.toHaveClass("MuiDataGrid-columnHeader--sortable");
    }
  });

  it("closes Build Information once its retrigger goes through and the status is refreshed", async () => {
    render(<UmtPendingReleaseChunksGrid />);

    await userEvent.click(screen.getByRole("button", { name: "See build info" }));
    await userEvent.click(within(buildInfoDialog()).getByRole("button", { name: "Retrigger Failed Builds" }));
    await confirmRetrigger();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.showSuccess).toHaveBeenCalledWith("Docker builds retriggered successfully.");
  });

  it("warns, and keeps Build Information open, when the retrigger went through but the status couldn't be refreshed", async () => {
    state.dockerMutate.mockResolvedValue({ statusRefreshed: false });
    render(<UmtPendingReleaseChunksGrid />);

    await userEvent.click(screen.getByRole("button", { name: "See build info" }));
    await userEvent.click(within(buildInfoDialog()).getByRole("button", { name: "Retrigger Failed Builds" }));
    await confirmRetrigger();

    await waitFor(() =>
      expect(state.showWarning).toHaveBeenCalledWith(
        "Docker builds were retriggered, but the release chunk status could not be refreshed.",
      ),
    );
    expect(state.showSuccess).not.toHaveBeenCalled();
    expect(state.showError).not.toHaveBeenCalled();
    // Once the confirmation has gone, Build Information is the dialog left.
    await waitFor(() => expect(screen.getByRole("dialog")).toBe(buildInfoDialog()));
  });

  it("shows a retriggering chunk as still releasing", () => {
    state.chunkStatus = "retriggering";
    render(<UmtPendingReleaseChunksGrid />);

    expect(screen.getByText("Releasing chunks…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retrigger Docker build" })).toBeNull();
  });
});

describe("UmtDockerRetriggerIcon", () => {
  it("draws in the surrounding text colour, at the size it is given", () => {
    const { container } = render(<UmtDockerRetriggerIcon size={16} />);

    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("fill", "currentColor");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("gives every icon its own mask, since a grid draws one per docker-failed row", () => {
    const { container } = render(
      <>
        <UmtDockerRetriggerIcon />
        <UmtDockerRetriggerIcon />
      </>,
    );

    const ids = [...container.querySelectorAll("mask")].map((mask) => mask.id);
    expect(new Set(ids).size).toBe(2);
    for (const group of container.querySelectorAll("g[mask]")) {
      expect(ids).toContain(group.getAttribute("mask")!.match(/^url\(#(.+)\)$/)![1]);
    }
  });
});
