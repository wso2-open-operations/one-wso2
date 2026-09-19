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

import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Link,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CalendarIcon, CopyIcon, EyeIcon, PencilIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParTeamDetails } from "../api/useLeadTeams";
import { useSend360Reminder } from "../api/useLeadReminders";
import { useLeadRatingUpdate } from "../api/useLeadRatingUpdate";
import { calculateCycleActiveStep } from "../util/parCycleActiveStep";
import { resolveGridSelectedIds } from "../util/parGridSelection";
import ParCompletionStatusCard from "./ParCompletionStatusCard";
import ParCycleDatesStepper from "./ParCycleDatesStepper";
import ParStatusChip from "./ParStatusChip";
import type { ParCycle, ParRatingMinimal, ParTeamSummary } from "../api/types";

// Ports TeamSummary.tsx: one team's completion cards + member roster.
// "Sync an Employee" (EmployeeSyncModal.tsx) isn't ported — source's own
// comment calls it "Temporary dialog for this cycle", and it needs a
// separate org-chart employee-search contract this port doesn't have yet.
export default function ParLeadTeamRoster({
  cycle,
  team,
  showBack,
  onBack,
  onOpenReview,
}: {
  cycle: ParCycle;
  team: ParTeamSummary;
  showBack: boolean;
  onBack: () => void;
  onOpenReview: (employeeEmail: string) => void;
}) {
  const details = useParTeamDetails(cycle.parCycleId, team.parTeamId);
  const send360Reminder = useSend360Reminder();
  const ratingUpdate = useLeadRatingUpdate(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();
  // No org-wide employee directory of our own — reuses Leave's for avatars.
  const employees = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(employees.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [employees.data],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [cycleDatesOpen, setCycleDatesOpen] = useState(false);
  const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (details.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (details.isError) {
    return (
      <ErrorNotice error={details.error} onRetry={() => details.refetch()} retrying={details.isFetching}>
        Couldn't load this team's roster.
      </ErrorNotice>
    );
  }

  const members = details.data?.details ?? [];
  const filteredMembers = members
    .filter((member) =>
      `${member.parEmployeeName.toLowerCase()}${member.parEmployeeEmail.toLowerCase()}`.includes(
        searchTerm.toLowerCase(),
      ),
    )
    .sort((a, b) => a.parEmployeeName.localeCompare(b.parEmployeeName));

  const selectedMembers = members.filter((m) => selectedIds.includes(m.parRatingId));

  const handleCopyEmails = async () => {
    try {
      await navigator.clipboard.writeText(selectedMembers.map((m) => m.parEmployeeEmail).join(", "));
      showSuccess("Emails copied to clipboard");
    } catch (err) {
      showError(describeError(err));
    }
  };

  // Validated before the confirm dialog opens, not only at confirm-time.
  const handleOpenShareConfirm = () => {
    if (!selectedMembers.every((m) => m.parLeadStatus === "DRAFT")) {
      showError("Unable to share selected reviews. Please select only draft reviews.");
      return;
    }
    setShareConfirmOpen(true);
  };

  const handleShareConfirmed = async () => {
    setShareConfirmOpen(false);
    // Re-validated in case the selection changed since the dialog opened.
    if (!selectedMembers.every((m) => m.parLeadStatus === "DRAFT")) {
      showError("Unable to share selected reviews. Please select only draft reviews.");
      return;
    }
    setSharing(true);
    let passedCount = 0;
    let failedCount = 0;
    const reasons: string[] = [];
    for (const member of selectedMembers) {
      try {
        await ratingUpdate.mutateAsync({
          employeeEmail: member.parEmployeeEmail,
          parRatingId: member.parRatingId,
          payload: { parLeadStatus: "SHARED" },
        });
        passedCount++;
      } catch (err) {
        failedCount++;
        reasons.push(describeError(err));
      }
    }
    setSharing(false);
    setSelectedIds([]);
    if (passedCount === 0) {
      showError(`Failed to share ${failedCount} ratings. ${reasons.join(", ")}`);
    } else if (failedCount !== 0) {
      showError(`Failed to update ${failedCount} ratings. ${reasons.join(", ")}`);
    } else {
      showSuccess(`Successfully updated ${passedCount} ratings`);
    }
  };

  const columns: DataGrid.GridColDef<ParRatingMinimal>[] = [
    {
      field: "parEmployeeName",
      headerName: "Team Member",
      flex: 1.5,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Box
            role="button"
            tabIndex={0}
            aria-label={`Open review for ${params.row.parEmployeeName}`}
            onClick={() => onOpenReview(params.row.parEmployeeEmail)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenReview(params.row.parEmployeeEmail);
              }
            }}
            sx={{ cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <Avatar
              src={thumbnailByEmail.get(params.row.parEmployeeEmail) || undefined}
              slotProps={{ img: { referrerPolicy: "no-referrer" } }}
              sx={{ mr: 1.5, height: "2.2rem", width: "2.2rem" }}
            />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => onOpenReview(params.row.parEmployeeEmail)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenReview(params.row.parEmployeeEmail);
                }
              }}
              sx={{ cursor: "pointer", width: "fit-content" }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {params.row.parEmployeeName}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {params.row.parEmployeeEmail}
              </Typography>
              <Tooltip title="Copy Email" arrow>
                <IconButton
                  size="small"
                  aria-label="Copy Email"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(params.row.parEmployeeEmail);
                      showSuccess("Email copied");
                    } catch (err) {
                      showError(describeError(err));
                    }
                  }}
                >
                  <CopyIcon size={13} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      ),
    },
    {
      field: "parEmployeeStatus",
      headerName: "Employee PAR",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parEmployeeStatus} />,
    },
    {
      field: "par360ReviewStatus",
      headerName: "360° Feedback",
      flex: 0.9,
      renderCell: (params) => (
        <ParStatusChip
          content={params.row.par360ReviewStatus}
          countDetails={{
            completed: params.row.par360ReviewCounts.sharedReviewCount,
            total: params.row.par360ReviewCounts.requestedReviewCount,
          }}
        />
      ),
    },
    {
      field: "parLeadStatus",
      headerName: "Lead's PAR",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parLeadStatus} />,
    },
    {
      field: "parRating",
      headerName: "Rating",
      flex: 0.8,
      renderCell: (params) => <ParStatusChip content={params.row.parRating ?? ""} />,
    },
    {
      field: "parSpecialRating",
      headerName: "Top 5%/20% Rating",
      flex: 0.9,
      renderCell: (params) => <ParStatusChip content={params.row.parSpecialRating ?? ""} />,
    },
    {
      field: "parF2fStatus",
      headerName: "F2F",
      flex: 0.6,
      renderCell: (params) => <ParStatusChip content={params.row.parF2fStatus} />,
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.5,
      renderCell: (params) => (
        <Tooltip title={params.row.parLeadStatus === "SHARED" ? "View" : "Review"} arrow>
          <IconButton onClick={() => onOpenReview(params.row.parEmployeeEmail)}>
            {params.row.parLeadStatus === "SHARED" ? <EyeIcon size={18} /> : <PencilIcon size={18} />}
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          {showBack && (
            <>
              <Link component="button" underline="hover" onClick={onBack} sx={{ mr: 0.5 }}>
                All Teams
              </Link>
              <Typography component="span" sx={{ mx: 0.5 }}>
                /
              </Typography>
            </>
          )}
          <Typography component="span" variant="h5">
            {[team.parBusinessUnit, team.parDepartment, team.parTeam, team.parSubTeam].filter(Boolean).join(" / ")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Open Cycle Dates" arrow>
            <IconButton onClick={() => setCycleDatesOpen(true)} aria-label="cycle dates">
              <CalendarIcon size={18} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" onClick={() => setReminderConfirmOpen(true)}>
            Send 360° Reminder
          </Button>
        </Stack>
      </Stack>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Completion Status
        </Typography>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ParCompletionStatusCard
              name="Employee PAR"
              completed={team.summary.employeeParCompletedCount}
              total={team.numberOfTeamMembers}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ParCompletionStatusCard
              name="Lead's PAR"
              completed={team.summary.leadsReviewCompletedCount}
              total={team.numberOfTeamMembers}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <ParCompletionStatusCard name="F2F" completed={team.summary.f2fCompletedCount} total={team.numberOfTeamMembers} />
          </Grid>
        </Grid>
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
          <Typography variant="h6">Members</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="contained" disabled={selectedIds.length === 0} onClick={handleCopyEmails} startIcon={<CopyIcon size={16} />}>
              Copy Emails
            </Button>
            <Button variant="contained" disabled={selectedIds.length === 0 || sharing} onClick={handleOpenShareConfirm}>
              Share
            </Button>
            <TextField
              size="small"
              placeholder="Search Members"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </Stack>

        <DataGrid.DataGrid
          rows={filteredMembers}
          columns={columns}
          getRowId={(row) => row.parRatingId}
          rowHeight={56}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={{ type: "include", ids: new Set(selectedIds) }}
          onRowSelectionModelChange={(model) => setSelectedIds(resolveGridSelectedIds(model, filteredMembers.map((m) => ({ id: m.parRatingId }))))}
          sx={{ border: "none" }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 20, 25]}
        />
      </Card>

      {/* TeamSummary.tsx opens this in its own CustomModal at width="80vw"
          — much wider than a fixed maxWidth breakpoint, since five stepper
          steps need the room. */}
      <Dialog
        open={cycleDatesOpen}
        onClose={() => setCycleDatesOpen(false)}
        maxWidth={false}
        slotProps={{ paper: { sx: { width: "80vw" } } }}
      >
        <DialogTitle>Cycle Dates</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 4, pb: 4 }}>
          <ParCycleDatesStepper cycle={cycle} activeStep={calculateCycleActiveStep(cycle)} />
        </DialogContent>
      </Dialog>

      {/* ConfirmationDialog's own threeSixtyReminder copy — same dialog as
          MultiTeamSummary.tsx's, reused here since both send the same
          lead-scoped reminder regardless of which team you're viewing.
          ConfirmationDialog.tsx's own maxWidth="md", not a narrower one-off. */}
      <Dialog open={reminderConfirmOpen} onClose={() => setReminderConfirmOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Send 360° Feedback Reminder?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            If you send 360° reminders, employees who haven't yet responded to their 360° feedback
            requests will receive a reminder. Do you wish to continue?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReminderConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={send360Reminder.isPending}
            onClick={() =>
              send360Reminder.mutate(undefined, {
                onSuccess: () => {
                  setReminderConfirmOpen(false);
                  showSuccess("Successfully sent");
                },
                onError: (err) => showError(describeError(err)),
              })
            }
          >
            {send360Reminder.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* leadParBulkShare copy (config/constant.ts). Always the same
          message regardless of selection validity — the draft-only check
          runs at confirm-time (handleShareConfirmed), not here.
          ConfirmationDialog.tsx's own maxWidth="md". */}
      <Dialog open={shareConfirmOpen} onClose={() => setShareConfirmOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Share Lead's Feedback?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will share the lead's feedback with all the selected members. You can't undo this
            action.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShareConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleShareConfirmed}>
            Share
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
