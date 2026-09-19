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
import { useNavigate } from "react-router";
import {
  Box,
  Button,
  Divider,
  Skeleton,
  Stack,
} from "@wso2/oxygen-ui";
import { Pause, RefreshCw, Rocket, CheckCircle, Plus } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { count, lifecycleChartData, releaseChunkChartData, type UmtDashboardDatum } from "../api/umtDashboardStats";
import { useUmtDashboardStats } from "../api/useUmtDashboardStats";
import { useUmtGate } from "../api/useUmtGate";
import {
  DashboardDonut,
  DashboardWidgetHolder,
  StatCard,
  type UmtDashboardColor,
} from "../components/UmtWidgets";
import UmtCreateUpdateDialog from "../components/UmtCreateUpdateDialog";
import MaintenanceDialog from "../components/MaintenanceDialog";
import UmtShell from "../components/UmtShell";
// Key colors by status rather than array position so reordering chart data does
// not silently change the meaning of a slice.
const LIFECYCLE_COLORS: Record<string, UmtDashboardColor> = {
  Development: "info",
  Testing: "success",
  Verifying: "warning",
  Pending: "error",
};

const BUILD_COLORS: Record<string, UmtDashboardColor> = {
  Pending: "info",
  Building: "warning",
  Successful: "success",
  Failed: "error",
};

const sumValues = (data: UmtDashboardDatum[]) =>
  data.reduce((total, item) => total + item.value, 0);

export default function UmtHomePage() {
  return (
    <UmtShell title="Updates Manager Dashboard">
      <UmtDashboardBody />
    </UmtShell>
  );
}

// This component is deliberately below UmtShell. React does not mount it until
// the UMT role gate succeeds, so /meta and /update/stats are never requested for
// a denied user.
function UmtDashboardBody() {
  const dashboardStats = useUmtDashboardStats();
  const navigate = useNavigate();
  // UmtShell has already resolved this query. Calling the gate here reads the
  // cached role decision needed for the admin-only release-chunk button.
  const gate = useUmtGate();
  const [createUpdateOpen, setCreateUpdateOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);

  const lifecycleData = dashboardStats.data ? lifecycleChartData(dashboardStats.data) : [];
  const releaseChunkData = dashboardStats.data ? releaseChunkChartData(dashboardStats.data) : [];
  const activeUpdates = sumValues(lifecycleData);
  const lifecycleCounts = dashboardStats.data?.updateLifeCycleCounts ?? {};
  // On Hold and Released aren't part of the Active donut, but they come from the
  // same service-keyed map as Testing/Verifying/Pending above. Their service keys
  // happen to match these display labels today, but that's an assumption, not a
  // guarantee — read them through the same `count` helper so a future rename in
  // the service is one place to fix, not a silent zero here.
  const onHoldCount = count(lifecycleCounts, "OnHold");
  const releasedCount = count(lifecycleCounts, "Released");
  const statValue = (value: number | undefined) =>
    dashboardStats.isPending
      ? <Skeleton variant="text" width={48} sx={{ fontSize: "inherit" }} />
      : dashboardStats.isError
        ? "—"
        : (value ?? 0);
  return (
    <Stack spacing={3} sx={{ maxWidth: "100%", pb: 4, width: "100%" }}>
      {dashboardStats.isError && (
        <ErrorNotice
          error={dashboardStats.error}
          onRetry={() => void dashboardStats.refetch()}
          retrying={dashboardStats.isFetching}
        >
          Couldn&apos;t load dashboard statistics.
        </ErrorNotice>
      )}
      <DashboardWidgetHolder
        title="Updates"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => navigate("/umt/updates")}
            >
              View updates
            </Button>
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setCreateUpdateOpen(true)}
            >
              Create
            </Button>
          </>
        }
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            position: "relative",
          }}
        >
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              justifyContent: "center",
              p: 2,
            }}
          >
            <DashboardDonut
              title="Active Updates"
              legendTitle="Lifecycle States"
              data={lifecycleData}
              colorMap={LIFECYCLE_COLORS}
              loading={dashboardStats.isPending}
              error={dashboardStats.isError}
            />
          </Box>

          <Divider
            orientation="vertical"
            aria-hidden="true"
            sx={{
              bottom: 0,
              display: { xs: "none", md: "block" },
              left: "50%",
              position: "absolute",
              top: 0,
            }}
          />

          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              justifyContent: "center",
              p: 2,
            }}
          >
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(2, minmax(150px, 260px))",
              }}
            >
              <StatCard
                label="Total"
                value={statValue(dashboardStats.data?.updateCount)}
                icon={<RefreshCw size={32} />}
                color="info"
              />
              <StatCard
                label="Active"
                value={statValue(activeUpdates)}
                icon={<Rocket size={32} />}
                color="warning"
              />
              <StatCard
                label="On Hold"
                value={statValue(onHoldCount)}
                icon={<Pause size={32} />}
                color="error"
              />
              <StatCard
                label="Released"
                value={statValue(releasedCount)}
                icon={<CheckCircle size={32} />}
                color="success"
              />
            </Box>
          </Box>
        </Box>
      </DashboardWidgetHolder>

      <DashboardWidgetHolder
        title="Release chunks"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => setMaintenanceModalOpen(true)}
            >
              View pending
            </Button>
            <Button
              variant="outlined"
              onClick={() => setMaintenanceModalOpen(true)}
            >
              View released
            </Button>
            {/* The source route admitted every UMT role by mistake;
              both this entry and the future route are admin-only. */}
            {gate.isAdmin && (
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={() => setMaintenanceModalOpen(true)}
              >
                Create
              </Button>
            )}
          </>
        }
      >
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
            p: 2,
          }}
        >
          <DashboardDonut
            title="Created Chunks"
            legendTitle="Build Status"
            data={releaseChunkData}
            colorMap={BUILD_COLORS}
            loading={dashboardStats.isPending}
            error={dashboardStats.isError}
            total={dashboardStats.data?.createdReleaseChunkBuildCount}
          />
        </Box>
      </DashboardWidgetHolder>

      <UmtCreateUpdateDialog
        open={createUpdateOpen}
        onClose={() => setCreateUpdateOpen(false)}
      />
      <MaintenanceDialog
        open={maintenanceModalOpen}
        onClose={() => setMaintenanceModalOpen(false)}
      />
    </Stack>
  );
}
