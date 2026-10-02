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
import { render } from "@testing-library/react";
import { CHUNK_LINE_HEIGHT } from "./umtReleaseChunkGridSx";

// The columns that render one entry per update level. The grid is only
// readable if entry N of each of them lands on the same line as entry N of
// the others, which is what the assertions below pin down: a column that
// skips an entry (because that level has no retrigger button to offer, say)
// throws every entry under it out of step with its neighbours.
const PER_LEVEL_FIELDS = [
  "updateLevels",
  "buildStatus",
  "buildAction",
  "tgBuildStatus",
  "tgBuildActions",
];

const CHUNK = {
  id: 42,
  updateIds: [101, 102],
  updateLevels: [
    // One level that can be retriggered and one that can't, so the columns
    // that only sometimes have a control in them are exercised too.
    { productName: "wso2am", productVersion: "4.2.0", buildStatus: "UNSTABLE" },
    { productName: "wso2is", productVersion: "7.0.0", buildStatus: "SUCCESS" },
  ],
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
  useFetchFreshUmtReleaseChunkBuildStatus: () => async () => undefined,
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
      buildStatus: {
        id: 42,
        updateIds: [101, 102],
        overallCstBuildStatus: "SUCCESS",
        // Deliberately the reverse of the chunk's own order, and named: the
        // two endpoints are matched on product, so ordering must not matter.
        updateLevels: [
          { productName: "wso2is", productVersion: "7.0.0", tgBuildStatus: "SUCCESS" },
          { productName: "wso2am", productVersion: "4.2.0", tgBuildStatus: "UNSTABLE" },
        ],
      },
      chunkStatus: { id: 42, updateIds: [101, 102], status: "created" },
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
  useUmtTriggerCstBuild: idleMutation,
  useUmtRetriggerDockerBuild: idleMutation,
  useUmtReleaseChunk: idleMutation,
  useUmtSendReleaseChunkEmail: idleMutation,
  useUmtRemoveReleaseChunk: idleMutation,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

const { default: UmtPendingReleaseChunksGrid } = await import("./UmtPendingReleaseChunksGrid");

function cellLines(field: string): HTMLElement[] {
  const cell = document.querySelector(`.MuiDataGrid-cell[data-field="${field}"]`);
  if (!cell) throw new Error(`no cell rendered for column "${field}"`);
  const chunkCell = cell.firstElementChild;
  if (!chunkCell) throw new Error(`cell for column "${field}" is empty`);
  return [...chunkCell.children] as HTMLElement[];
}

describe("UmtPendingReleaseChunksGrid", () => {
  it("gives every per-level column one line per update level", () => {
    render(<UmtPendingReleaseChunksGrid />);

    for (const field of PER_LEVEL_FIELDS) {
      expect(cellLines(field), field).toHaveLength(CHUNK.updateLevels.length);
    }
  });

  it("lays every line out at the same height, so the columns stay in step", () => {
    render(<UmtPendingReleaseChunksGrid />);

    const heights = new Set(
      PER_LEVEL_FIELDS.flatMap((field) =>
        cellLines(field).map((line) => getComputedStyle(line).minHeight),
      ),
    );

    expect([...heights]).toEqual([`${CHUNK_LINE_HEIGHT}px`]);
  });

  it("rules under every level of a per-level cell, including the last, but not within a single-value one", () => {
    render(<UmtPendingReleaseChunksGrid />);

    // The rule sits under every line, the last included, so the build-detail
    // columns end on a rule rather than trailing off unmarked.
    const ruled = cellLines("updateLevels").filter(
      (line) => getComputedStyle(line).borderBottomStyle === "solid",
    );
    expect(ruled).toHaveLength(CHUNK.updateLevels.length);

    // Update IDs are not per-level — they are a separate list, so ruling them
    // would imply an alignment with the columns beside them that isn't real.
    const unruled = cellLines("updateIds").filter(
      (line) => getComputedStyle(line).borderBottomStyle === "solid",
    );
    expect(unruled).toHaveLength(0);
  });

  it("shows each product's own TG build status, whatever order the status response is in", () => {
    render(<UmtPendingReleaseChunksGrid />);

    // The status response lists wso2is first and wso2am second, the reverse of
    // the chunk. Joining the two by position would put wso2is's SUCCESS on
    // wso2am's line and wso2am's UNSTABLE on wso2is's — each product wearing
    // the other's build result, with nothing on screen to give it away.
    const products = cellLines("updateLevels").map((line) => line.textContent);
    const tgStatuses = cellLines("tgBuildStatus").map((line) => line.textContent);

    expect(products).toEqual(["wso2am (4.2.0)", "wso2is (7.0.0)"]);
    expect(tgStatuses).toEqual(["Unstable", "Successful"]);
  });

  it("rules under a group title only where the group has titles beneath it", () => {
    render(<UmtPendingReleaseChunksGrid />);

    const groupTitle = (fields: string) =>
      document.querySelector(
        `.MuiDataGrid-columnHeader--filledGroup[data-fields="${fields}"] .MuiDataGrid-columnHeaderTitleContainer`,
      );

    // A column that is its own group carries its title in the upper row with
    // nothing under it, so a rule there would split one header in two.
    for (const field of ["id", "updateIds", "actions"]) {
      const title = groupTitle(`|-${field}-|`);
      if (!title) throw new Error(`no group header rendered for "${field}"`);
      expect(getComputedStyle(title).borderBottomWidth, field).toBe("0px");
    }

    // "Build Details" does cover columns with their own titles, so the rule
    // between it and them stays.
    const buildDetails = document.querySelector(
      '.MuiDataGrid-columnHeader--filledGroup[data-fields*="-updateLevels-"] .MuiDataGrid-columnHeaderTitleContainer',
    );
    if (!buildDetails) throw new Error("no group header rendered for the build-detail columns");
    expect(getComputedStyle(buildDetails).borderBottomStyle).toBe("solid");
  });

  it("adds no padding of its own around a cell's lines, so the first and last line get the same breathing room as any line in between", () => {
    render(<UmtPendingReleaseChunksGrid />);

    for (const field of PER_LEVEL_FIELDS) {
      const cell = document.querySelector(`.MuiDataGrid-cell[data-field="${field}"]`);
      const chunkCell = cell?.firstElementChild;
      if (!chunkCell) throw new Error(`cell for column "${field}" is empty`);
      const style = getComputedStyle(chunkCell);
      // Any padding here would land only on the first/last line (nothing sits
      // between it and the cell's own edge), not on the lines in the middle —
      // exactly the asymmetry reported: more space above the first line's
      // text than below it, and the mirror image on the last line.
      expect(style.paddingTop, field).toBe("0px");
      expect(style.paddingBottom, field).toBe("0px");
    }
  });
});
