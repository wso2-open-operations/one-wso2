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

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  DataGrid,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  InboxIcon,
  LockOpenIcon,
  MailIcon,
  RocketIcon,
  RotateCwIcon,
  ZapIcon,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type {
  UmtReleaseChunk,
  UmtReleaseChunkUpdateLevel,
} from "../../api/umtReleaseChunks";
import {
  useUmtRemoveReleaseChunk,
  useUmtReleaseChunk,
  useUmtRetriggerDockerBuild,
  useUmtSendReleaseChunkEmail,
  useUmtRetriggerCstBuild,
  useUmtTriggerProductBuild,
  useUmtTriggerReleaseChunkBuilds,
  useUmtTriggerTgBuild,
} from "../../api/useUmtReleaseChunkActions";
import {
  useFetchFreshUmtReleaseChunkBuildStatus,
  useUmtReleaseChunkRowStatuses,
  useUmtReleaseChunks,
  type UmtReleaseChunkRowStatus,
} from "../../api/useUmtReleaseChunks";
import { useUmtGate } from "../../api/useUmtGate";
import {
  umtCanRetriggerBuild,
  umtCanRetriggerCstBuild,
  umtReleaseChunkRowAction,
  umtReleaseReadiness,
  type UmtReleaseChunkRowAction,
} from "../../lib/umtReleaseChunks";
import UmtReleaseChunkBuildInfoDialog from "./UmtReleaseChunkBuildInfoDialog";
import UmtReleaseChunkConfirmDialog from "./UmtReleaseChunkConfirmDialog";
import UmtDockerRetriggerIcon from "./UmtDockerRetriggerIcon";
import {
  BuildStatusChip,
  ChunkCell,
  ChunkLine,
} from "./umtReleaseChunkGridPrimitives";
import { UMT_CHUNK_GRID_BORDERED_SX } from "./umtReleaseChunkGridSx";

const { DataGrid: DataGridComponent } = DataGrid;

type ActionKind =
  "email" | "trigger-tests" | "cst-retrigger" | "docker-retrigger" | "release";

interface ActionTarget {
  kind: ActionKind;
  chunkId: number;
}

const ACTION_COPY: Record<
  ActionKind,
  {
    title: string;
    message: (chunkId: number) => string;
    confirmLabel: string;
    confirmColor?: "error";
  }
> = {
  email: {
    title: "Confirm Email Sending",
    message: (id) =>
      `Are you sure you want to send the status email for release chunk ID: ${id}?`,
    confirmLabel: "Confirm",
  },
  "trigger-tests": {
    title: "Trigger Tests",
    message: (id) =>
      `Are you sure you want to trigger test builds for release chunk ID: ${id}?`,
    confirmLabel: "Confirm",
  },
  "cst-retrigger": {
    title: "Trigger CST Build?",
    message: (id) =>
      `Are you sure you want to trigger CST build for release chunk ID: ${id}?`,
    confirmLabel: "Confirm",
  },
  "docker-retrigger": {
    title: "Retrigger Docker Builds",
    message: (id) =>
      `Are you sure you want to retrigger failed Docker builds for release chunk ID: ${id}?`,
    confirmLabel: "Confirm",
  },
  release: {
    title: "All tests are passed!",
    message: (id) => `Release release chunk ID: ${id}?`,
    confirmLabel: "Proceed and Release",
  },
};

// One update level's TG build status, which comes from a different request
// than the update level itself. The two are matched on the product and
// version they describe rather than on their position in each response:
// nothing obliges two endpoints to order their update levels alike, or to
// list the same ones, and a positional match that slips shows one product's
// build status against another product's name with nothing to reveal it.
//
// Two kinds of "missing" stay apart. A product the status response does not
// mention reads as not triggered, since there is no build to report; a
// product it mentions without a TG status reads as a failure, which is what
// an empty status on a build that should have one means.
function tgBuildStatusOf(
  status: UmtReleaseChunkRowStatus | undefined,
  level: UmtReleaseChunkUpdateLevel,
): string {
  const levels = status?.buildStatus?.updateLevels;
  if (!levels) return "UNKNOWN";
  const match = levels.find(
    (candidate) =>
      candidate.productName === level.productName &&
      candidate.productVersion === level.productVersion,
  );
  if (!match) return "UNKNOWN";
  return match.tgBuildStatus || "N/A";
}

// The six per-update-level columns sit under one "Build Details" title, so it
// is clear at a glance which columns describe a level and which describe the
// chunk. The three standalone columns carry their name on the group instead of
// on the column, which is why their own headerName is blank below.
function columnGroupingModel(
  isAdmin: boolean,
): DataGrid.GridColumnGroupingModel {
  return [
    {
      groupId: "releaseChunkDetails",
      headerName: "Release Chunk ID",
      children: [{ field: "id" }],
    },
    {
      groupId: "updateIdsGroup",
      headerName: "Update IDs",
      children: [{ field: "updateIds" }],
    },
    {
      groupId: "buildDetails",
      headerName: "Build Details",
      headerAlign: "center",
      children: [
        { field: "updateLevels" },
        { field: "buildStatus" },
        ...(isAdmin ? [{ field: "buildAction" }] : []),
        { field: "tgBuildStatus" },
        ...(isAdmin ? [{ field: "tgBuildActions" }] : []),
        { field: "cstBuildStatus" },
        ...(isAdmin ? [{ field: "cstBuildAction" }] : []),
      ],
    },
    {
      groupId: "actionsGroup",
      headerName: "Actions",
      children: isAdmin ? [{ field: "actions" }] : [],
    },
  ];
}

export default function UmtPendingReleaseChunksGrid() {
  const chunks = useUmtReleaseChunks();
  const gate = useUmtGate();
  const rows = chunks.data ?? [];
  const rowStatuses = useUmtReleaseChunkRowStatuses(rows.map((row) => row.id));
  const fetchFreshBuildStatus = useFetchFreshUmtReleaseChunkBuildStatus();
  const { showSuccess, showError, showWarning } = useNotifications();

  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [buildInfoChunkId, setBuildInfoChunkId] = useState<number | null>(null);

  const targetChunkId = actionTarget?.chunkId ?? 0;
  const emailMutation = useUmtSendReleaseChunkEmail(targetChunkId);
  const triggerBuildsMutation = useUmtTriggerReleaseChunkBuilds(targetChunkId);
  const cstMutation = useUmtRetriggerCstBuild(targetChunkId);
  const dockerMutation = useUmtRetriggerDockerBuild(targetChunkId);
  const releaseMutation = useUmtReleaseChunk(targetChunkId);

  const confirmBusy =
    emailMutation.isPending ||
    triggerBuildsMutation.isPending ||
    cstMutation.isPending ||
    dockerMutation.isPending ||
    releaseMutation.isPending;

  const latestActionRequest = useRef(0);

  // Stable, so that the column definitions closing over it can be too.
  const requestAction = useCallback((kind: ActionKind, chunkId: number) => {
    latestActionRequest.current += 1;
    setActionTarget({ kind, chunkId });
  }, []);

  // Release is offered only once every update level has built successfully.
  // The build status is fetched fresh on every click rather than read from the
  // row, since a level may have been rebuilt since the page loaded. A status
  // that cannot be fetched is answered rather than waved through — see
  // umtReleaseReadiness.
  const handleReleaseClick = useCallback(
    async (chunkId: number) => {
      const request = ++latestActionRequest.current;
      const buildStatus = await fetchFreshBuildStatus(chunkId);
      if (request !== latestActionRequest.current) return;
      switch (umtReleaseReadiness(buildStatus)) {
        case "ready":
          requestAction("release", chunkId);
          return;
        case "blocked":
          showWarning(
            "Cannot release the release chunk with integration test failures, please escalate to the relevant product teams to get them successful.",
          );
          return;
        default:
          showWarning(
            "Build status for this release chunk is unavailable, so it cannot be released yet. Reload the page and try again.",
          );
      }
    },
    [fetchFreshBuildStatus, requestAction, showWarning],
  );

  async function handleConfirm() {
    if (!actionTarget) return;
    try {
      switch (actionTarget.kind) {
        case "email":
          await emailMutation.mutateAsync();
          showSuccess("Email sent successfully.");
          break;
        case "trigger-tests":
          await triggerBuildsMutation.mutateAsync();
          showSuccess("Triggered successfully.");
          break;
        case "cst-retrigger":
          await cstMutation.mutateAsync();
          showSuccess("CST build retriggered successfully.");
          break;
        case "docker-retrigger": {
          const { statusRefreshed } = await dockerMutation.mutateAsync();
          // The builds were retriggered either way. Build Information stays
          // open only when the chunk's new status couldn't be read, since the
          // row behind it would otherwise still show the failure.
          if (statusRefreshed) {
            showSuccess("Docker builds retriggered successfully.");
            setBuildInfoChunkId(null);
          } else {
            showWarning(
              "Docker builds were retriggered, but the release chunk status could not be refreshed.",
            );
          }
          break;
        }
        case "release":
          await releaseMutation.mutateAsync();
          showSuccess("Chunks released successfully.");
          break;
      }
      setActionTarget(null);
    } catch (error) {
      showError(describeError(error));
    }
  }

  // Memoized because the grid rebuilds its whole column state whenever this
  // array is a new reference — its own guard for that is a reference check —
  // and with auto row heights that re-measures every row. Without this, every
  // dialog opening and every mutation's pending flag redid the table's layout.
  const columns: DataGrid.GridColDef<UmtReleaseChunk>[] = useMemo(
    () => [
      {
        field: "id",
        headerName: "",
        width: 80,
        sortable: false,
        renderCell: (params) => (
          <ChunkCell>
            <ChunkLine>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {params.row.id}
              </Typography>
            </ChunkLine>
          </ChunkCell>
        ),
      },
      {
        field: "updateIds",
        headerName: "",
        width: 110,
        sortable: false,
        renderCell: (params) => (
          <ChunkCell>
            {params.row.updateIds.map((id) => (
              <ChunkLine key={id}>
                <Typography variant="body2">{id}</Typography>
              </ChunkLine>
            ))}
          </ChunkCell>
        ),
      },
      {
        field: "updateLevels",
        headerName: "Update Levels",
        flex: 2,
        minWidth: 220,
        sortable: false,
        renderCell: (params) => (
          <ChunkCell divided>
            {params.row.updateLevels.map((level, index) => (
              <ChunkLine key={index}>
                <Typography variant="body2">
                  {level.productName ?? "N/A"} ({level.productVersion ?? "N/A"})
                </Typography>
              </ChunkLine>
            ))}
          </ChunkCell>
        ),
      },
      {
        field: "buildStatus",
        headerName: "Build Status",
        width: 150,
        sortable: false,
        renderCell: (params) => (
          <ChunkCell divided>
            {params.row.updateLevels.map((level, index) => (
              <ChunkLine key={index}>
                <BuildStatusChip status={level.buildStatus} />
              </ChunkLine>
            ))}
          </ChunkCell>
        ),
      },
      ...(gate.isAdmin
        ? [
            {
              field: "buildAction",
              headerName: "Build Action",
              width: 110,
              sortable: false,
              renderCell: (
                params: DataGrid.GridRenderCellParams<UmtReleaseChunk>,
              ) => (
                <ChunkCell divided>
                  {params.row.updateLevels.map((level, index) => (
                    <ProductBuildRetriggerButton
                      key={index}
                      chunkId={params.row.id}
                      level={level}
                    />
                  ))}
                </ChunkCell>
              ),
            } as DataGrid.GridColDef<UmtReleaseChunk>,
          ]
        : []),
      {
        field: "tgBuildStatus",
        headerName: "TG Build Status",
        width: 150,
        sortable: false,
        renderCell: (params) => {
          const status = rowStatuses[params.row.id];
          return (
            <ChunkCell divided>
              {params.row.updateLevels.map((level, index) => (
                <ChunkLine key={index}>
                  {status?.buildStatusLoading ? (
                    <Skeleton variant="text" width={80} />
                  ) : (
                    <BuildStatusChip status={tgBuildStatusOf(status, level)} />
                  )}
                </ChunkLine>
              ))}
            </ChunkCell>
          );
        },
      },
      ...(gate.isAdmin
        ? [
            {
              field: "tgBuildActions",
              headerName: "TG Build Action",
              width: 110,
              sortable: false,
              renderCell: (
                params: DataGrid.GridRenderCellParams<UmtReleaseChunk>,
              ) => {
                const status = rowStatuses[params.row.id];
                return (
                  <ChunkCell divided>
                    {params.row.updateLevels.map((level, index) => (
                      <TgBuildRetriggerButton
                        key={index}
                        chunkId={params.row.id}
                        level={level}
                        status={tgBuildStatusOf(status, level)}
                      />
                    ))}
                  </ChunkCell>
                );
              },
            } as DataGrid.GridColDef<UmtReleaseChunk>,
          ]
        : []),
      {
        field: "cstBuildStatus",
        headerName: "CST Build Status",
        width: 150,
        sortable: false,
        renderCell: (params) => {
          const status = rowStatuses[params.row.id];
          return (
            <ChunkCell>
              <ChunkLine>
                {status?.buildStatusLoading ? (
                  <Skeleton variant="text" width={80} />
                ) : (
                  <BuildStatusChip
                    status={
                      status?.buildStatus?.overallCstBuildStatus ?? "UNKNOWN"
                    }
                  />
                )}
              </ChunkLine>
            </ChunkCell>
          );
        },
      },
      ...(gate.isAdmin
        ? [
            {
              field: "cstBuildAction",
              headerName: "CST Build Action",
              width: 110,
              sortable: false,
              renderCell: (
                params: DataGrid.GridRenderCellParams<UmtReleaseChunk>,
              ) => {
                const status = rowStatuses[params.row.id];
                const cstStatus =
                  status?.buildStatus?.overallCstBuildStatus ?? "UNKNOWN";
                return (
                  <ChunkCell>
                    <ChunkLine>
                      {umtCanRetriggerCstBuild(cstStatus) ? (
                        <Tooltip title="Retrigger CST Job">
                          <IconButton
                            size="small"
                            aria-label="Retrigger CST Job"
                            onClick={() =>
                              requestAction("cst-retrigger", params.row.id)
                            }
                          >
                            <RotateCwIcon size={16} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </ChunkLine>
                  </ChunkCell>
                );
              },
            } as DataGrid.GridColDef<UmtReleaseChunk>,
          ]
        : []),
      ...(gate.isAdmin
        ? [
            {
              field: "actions",
              headerName: "",
              flex: 1.5,
              minWidth: 200,
              sortable: false,
              renderCell: (
                params: DataGrid.GridRenderCellParams<UmtReleaseChunk>,
              ) => {
                const chunkStatus = rowStatuses[params.row.id]?.chunkStatus;
                const action = umtReleaseChunkRowAction(
                  chunkStatus?.status,
                  chunkStatus?.failedReason,
                );
                return (
                  <RowActionsCell
                    action={action}
                    chunkId={params.row.id}
                    onRelease={handleReleaseClick}
                    onRequestAction={requestAction}
                    onShowBuildInfo={setBuildInfoChunkId}
                  />
                );
              },
            } as DataGrid.GridColDef<UmtReleaseChunk>,
          ]
        : []),
    ],
    [gate.isAdmin, handleReleaseClick, requestAction, rowStatuses],
  );

  const groupingModel = useMemo(
    () => columnGroupingModel(gate.isAdmin),
    [gate.isAdmin],
  );

  const activeCopy = actionTarget ? ACTION_COPY[actionTarget.kind] : null;

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      {chunks.isError && (
        <ErrorNotice
          error={chunks.error}
          onRetry={() => void chunks.refetch()}
          retrying={chunks.isFetching}
        >
          Couldn&apos;t load pending release chunks.
        </ErrorNotice>
      )}

      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {chunks.isFetching && !chunks.isPending && (
          <LinearProgress
            sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 4 }}
          />
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGridComponent
            columnHeaderHeight={40}
            columnGroupingModel={groupingModel}
            columns={columns}
            disableColumnMenu
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            hideFooter
            loading={chunks.isPending}
            rows={rows}
            slots={{ noRowsOverlay: PendingChunksEmptyState }}
            sx={UMT_CHUNK_GRID_BORDERED_SX}
          />
        </Box>
      </Paper>

      <UmtReleaseChunkConfirmDialog
        open={actionTarget !== null}
        title={activeCopy?.title ?? ""}
        message={actionTarget ? activeCopy!.message(actionTarget.chunkId) : ""}
        confirmLabel={activeCopy?.confirmLabel}
        confirmColor={
          activeCopy?.confirmColor === "error" ? "error" : "primary"
        }
        busy={confirmBusy}
        onCancel={() => setActionTarget(null)}
        onConfirm={() => void handleConfirm()}
      />

      <UmtReleaseChunkBuildInfoDialog
        open={buildInfoChunkId !== null}
        chunkId={buildInfoChunkId}
        onClose={() => setBuildInfoChunkId(null)}
        onRetriggerDocker={() =>
          buildInfoChunkId !== null &&
          requestAction("docker-retrigger", buildInfoChunkId)
        }
        retriggerBusy={dockerMutation.isPending}
      />
    </Stack>
  );
}

function RowActionsCell({
  action,
  chunkId,
  onRelease,
  onRequestAction,
  onShowBuildInfo,
}: {
  action: UmtReleaseChunkRowAction;
  chunkId: number;
  onRelease: (chunkId: number) => void;
  onRequestAction: (kind: ActionKind, chunkId: number) => void;
  onShowBuildInfo: (chunkId: number) => void;
}) {
  switch (action.kind) {
    case "release":
      return (
        <ChunkCell>
          <ChunkLine>
            <Tooltip title="Release">
              <IconButton
                size="small"
                aria-label="Release"
                onClick={() => onRelease(chunkId)}
              >
                <RocketIcon size={16} />
              </IconButton>
            </Tooltip>
          </ChunkLine>
          {action.failedReason && (
            <ChunkLine>
              <Typography variant="caption" color="error">
                Releasing release chunk Failed: {action.failedReason}
              </Typography>
            </ChunkLine>
          )}
        </ChunkCell>
      );
    case "docker-retrigger":
      return (
        <ChunkCell>
          <ChunkLine>
            <Tooltip title="Retrigger Docker build">
              <IconButton
                size="small"
                aria-label="Retrigger Docker build"
                onClick={() => onRequestAction("docker-retrigger", chunkId)}
              >
                <UmtDockerRetriggerIcon size={16} />
              </IconButton>
            </Tooltip>
          </ChunkLine>
          {action.failedReason && (
            <ChunkLine>
              <Typography variant="caption" color="error">
                {action.failedReason}
              </Typography>
            </ChunkLine>
          )}
          <ChunkLine>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onShowBuildInfo(chunkId)}
              sx={{ mb: 1 }}
            >
              See build info
            </Button>
          </ChunkLine>
        </ChunkCell>
      );
    case "in-progress":
      return (
        <ChunkCell>
          <ChunkLine gap={1}>
            <CircularProgress size={16} />
            <Typography variant="body2">Releasing chunks…</Typography>
          </ChunkLine>
        </ChunkCell>
      );
    case "created":
      return (
        <ChunkCell>
          <ChunkLine>
            <UnlockChunkButton chunkId={chunkId} />
            <Tooltip title="Run test builds">
              <IconButton
                size="small"
                aria-label="Run test builds"
                onClick={() => onRequestAction("trigger-tests", chunkId)}
              >
                <ZapIcon size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send status email">
              <IconButton
                size="small"
                aria-label="Send status email"
                onClick={() => onRequestAction("email", chunkId)}
              >
                <MailIcon size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Release">
              <IconButton
                size="small"
                aria-label="Release"
                onClick={() => onRelease(chunkId)}
              >
                <RocketIcon size={16} />
              </IconButton>
            </Tooltip>
          </ChunkLine>
        </ChunkCell>
      );
    case "none":
    default:
      return null;
  }
}

// Unlocking removes the chunk and demotes its updates back out of it, freeing
// them to be edited and re-chunked.
function UnlockChunkButton({ chunkId }: { chunkId: number }) {
  const { showError } = useNotifications();
  const unlock = useUmtRemoveReleaseChunk(chunkId);
  return (
    <Tooltip title="Unlock update level">
      <IconButton
        size="small"
        aria-label="Unlock update level"
        disabled={unlock.isPending}
        onClick={async () => {
          try {
            await unlock.mutateAsync();
          } catch (error) {
            showError(describeError(error));
          }
        }}
      >
        {unlock.isPending ? (
          <CircularProgress size={16} />
        ) : (
          <LockOpenIcon size={16} />
        )}
      </IconButton>
    </Tooltip>
  );
}

function ProductBuildRetriggerButton({
  chunkId,
  level,
}: {
  chunkId: number;
  level: UmtReleaseChunkUpdateLevel;
}) {
  const trigger = useUmtTriggerProductBuild(chunkId);
  return (
    <LevelBuildRetriggerButton
      label="Retrigger Job"
      title="Retrigger Build"
      successMessage="Build triggered successfully!"
      canRetrigger={umtCanRetriggerBuild(level.buildStatus)}
      chunkId={chunkId}
      level={level}
      trigger={trigger}
    />
  );
}

function TgBuildRetriggerButton({
  chunkId,
  level,
  status,
}: {
  chunkId: number;
  level: UmtReleaseChunkUpdateLevel;
  status?: string | null;
}) {
  const trigger = useUmtTriggerTgBuild(chunkId);
  return (
    <LevelBuildRetriggerButton
      label="Retrigger TG Job"
      title="Retrigger TG Build"
      successMessage="TG build triggered successfully!"
      canRetrigger={umtCanRetriggerBuild(status)}
      chunkId={chunkId}
      level={level}
      trigger={trigger}
    />
  );
}

// A retrigger for one update level. Like every other build action on this
// screen it starts a job outside the app, so it asks first.
function LevelBuildRetriggerButton({
  label,
  title,
  successMessage,
  canRetrigger,
  chunkId,
  level,
  trigger,
}: {
  label: string;
  title: string;
  successMessage: string;
  canRetrigger: boolean;
  chunkId: number;
  level: UmtReleaseChunkUpdateLevel;
  trigger: ReturnType<typeof useUmtTriggerProductBuild>;
}) {
  const { showSuccess, showError } = useNotifications();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Still a line, even with nothing to offer: the levels below it have to
  // stay on the same rows as their names and statuses in the columns beside.
  if (!canRetrigger) {
    return <ChunkLine />;
  }
  const levelName = `${level.productName ?? "N/A"} ${level.productVersion ?? ""}`.trim();

  async function handleConfirm() {
    try {
      await trigger.mutateAsync({
        productName: level.productName ?? "",
        productVersion: level.productVersion ?? "",
        channel: "full",
      });
      setConfirmOpen(false);
      showSuccess(successMessage);
    } catch (error) {
      showError(describeError(error));
    }
  }

  return (
    <ChunkLine>
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          disabled={trigger.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {trigger.isPending ? (
            <CircularProgress size={16} />
          ) : (
            <RotateCwIcon size={16} />
          )}
        </IconButton>
      </Tooltip>
      <UmtReleaseChunkConfirmDialog
        open={confirmOpen}
        title={title}
        message={`Are you sure you want to retrigger the build for ${levelName} in release chunk ID: ${chunkId}?`}
        confirmLabel="Confirm"
        busy={trigger.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirm()}
      />
    </ChunkLine>
  );
}

function PendingChunksEmptyState() {
  return (
    <Stack
      sx={{
        alignItems: "center",
        color: "text.disabled",
        height: "100%",
        justifyContent: "center",
      }}
      spacing={1}
    >
      <InboxIcon size={36} />
      <Typography variant="body2">No pending release chunks</Typography>
    </Stack>
  );
}
