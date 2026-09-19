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
  Alert,
  Avatar,
  Box,
  Card,
  DataGrid,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CalendarIcon, CopyIcon, EyeIcon, PencilIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { formatShortDate } from "../util/parDate";
import { useActiveParCycle } from "../api/useParData";
import { useParAdditionalReports } from "../api/useLeadReports";
import { filterAdditionalReports } from "../util/parAdditionalReports";
import { calculateCycleActiveStep } from "../util/parCycleActiveStep";
import ParCycleDatesStepper from "../components/ParCycleDatesStepper";
import ParStatusChip from "../components/ParStatusChip";
import ParLeadReviewTabs from "../components/ParLeadReviewTabs";
import type { ParAdditionalReport } from "../api/types";

// People Ops → Performance → Lead Portal → Additional Reports: par-app's
// EmployeeReportView.tsx. Every employee this lead has SOME oversight of but
// doesn't directly manage — additional-lead or reporting-chain relationships
// — as opposed to Direct Reports' own team roster. The endpoint actually
// returns both direct and indirect reports; this tab keeps only the
// indirect ones (filterAdditionalReports), matching source exactly.
export default function ParLeadAdditionalReportsTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const reports = useParAdditionalReports(cycle?.parCycleId, workEmail);
  const { showSuccess, showError } = useNotifications();
  // No org-wide employee directory of our own — reuses Leave's for avatars.
  const thumbnails = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(thumbnails.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [thumbnails.data],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [cycleDatesOpen, setCycleDatesOpen] = useState(false);
  const [reviewEmployeeEmail, setReviewEmployeeEmail] = useState<string | undefined>(undefined);

  if (activeCycles.isLoading || profile.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load the current PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">Currently there is no ongoing PAR cycle</Alert>;
  }
  if (reports.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (reports.isError) {
    return (
      <ErrorNotice error={reports.error} onRetry={() => reports.refetch()} retrying={reports.isFetching}>
        Couldn't load your additional reports.
      </ErrorNotice>
    );
  }

  if (reviewEmployeeEmail) {
    return (
      <ParLeadReviewTabs cycle={cycle} employeeEmail={reviewEmployeeEmail} onBack={() => setReviewEmployeeEmail(undefined)} />
    );
  }

  const rows = filterAdditionalReports(reports.data ?? [], searchQuery);

  const columns: DataGrid.GridColDef<ParAdditionalReport>[] = [
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
            onClick={() => setReviewEmployeeEmail(params.row.parEmployeeEmail)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setReviewEmployeeEmail(params.row.parEmployeeEmail);
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
              onClick={() => setReviewEmployeeEmail(params.row.parEmployeeEmail)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setReviewEmployeeEmail(params.row.parEmployeeEmail);
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
          <IconButton onClick={() => setReviewEmployeeEmail(params.row.parEmployeeEmail)}>
            {params.row.parLeadStatus === "SHARED" ? <EyeIcon size={18} /> : <PencilIcon size={18} />}
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Grid container spacing={2} sx={{ alignItems: "center" }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box display="flex" alignItems="center">
            <Typography variant="h4" component="span">
              {cycle.parCycleName}{" "}
            </Typography>
            <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
              ({formatShortDate(cycle.parCycleStartDate)} - {formatShortDate(cycle.parCycleEndDate)})
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Tooltip title="Open Cycle Dates" arrow>
              <IconButton onClick={() => setCycleDatesOpen(true)} aria-label="cycle dates">
                <CalendarIcon size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ p: 2 }}>
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.parRatingId}
          rowHeight={56}
          disableRowSelectionOnClick
          sx={{ border: "none" }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 20, 25]}
        />
      </Card>

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
    </Stack>
  );
}
