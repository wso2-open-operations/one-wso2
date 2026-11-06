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
import { Avatar, Box, IconButton, Skeleton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { QrCode } from "@wso2/oxygen-ui-icons-react";
import type { Employee, UserInfo } from "../api/types";
import { display, fullName, initialsOf } from "../api/derive";
import EmployeeQrDialog from "./EmployeeQrDialog";

// Orange-gradient hero header. Left = large avatar; right of avatar = name
// + designation. Oxygen's QR icon opens the employee QR dialog (same
// endpoint people-app uses: GET /employees/{id}/qr-code). ID, work email,
// business unit etc. live in the General Info card below.
export default function ProfileHero({
  userInfo,
  employee,
  isLoading,
}: {
  userInfo?: UserInfo;
  employee?: Employee;
  isLoading?: boolean;
}) {
  const name = employee ? fullName(employee) : userInfo ? fullName(userInfo) : "";
  const initials = employee ? initialsOf(employee) : userInfo ? initialsOf(userInfo) : "";
  const thumbnail = employee?.employeeThumbnail ?? userInfo?.employeeThumbnail ?? null;
  const designation = employee?.designation ?? userInfo?.designation ?? null;
  const employeeId = employee?.employeeId ?? userInfo?.employeeId;
  const workEmail = employee?.workEmail ?? userInfo?.workEmail;

  const [qrOpen, setQrOpen] = useState(false);

  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        p: "20px 22px",
        mb: 1.75,
        display: "flex",
        alignItems: "center",
        gap: 2.25,
        overflow: "hidden",
        // Use the palette CSS var directly, not t.palette.primary.light —
        // under CssVarsProvider the callback resolves that to the light
        // scheme's pastel pink (#FDEDE8) at theme construction, so in
        // dark mode the gradient painted a washed-out sunset over dark
        // paper. Referencing the CSS var lets the gradient adapt to the
        // active color scheme (light-mode = pastel pink, dark-mode =
        // 18%-opacity orange over #141417).
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(120deg, var(--oxygen-palette-primary-light) 0%, transparent 55%)",
          pointerEvents: "none",
        },
      }}
    >
      <Avatar
        src={thumbnail ?? undefined}
        sx={(theme) => ({
          position: "relative",
          width: 78,
          height: 78,
          fontSize: 28,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, #ff8a5c)`,
          border: "2px solid",
          borderColor: "common.white",
          ...theme.applyStyles("dark", {
            borderColor: "color-mix(in srgb, var(--oxygen-palette-primary-light) 62%, white)",
          }),
          boxShadow: "0 4px 14px rgba(241,78,35,.28)",
          flexShrink: 0,
        })}
      >
        {initials || "?"}
      </Avatar>

      <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
        {isLoading && !name ? (
          <Skeleton variant="text" width={220} height={32} sx={{ mb: 0.5 }} />
        ) : (
          <Typography variant="h5" sx={{ mb: 0.375 }}>
            {name || display(null)}
          </Typography>
        )}
        {isLoading && !designation ? (
          <Skeleton variant="text" width={180} height={18} />
        ) : designation ? (
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", fontWeight: 500 }}>
            {designation}
          </Typography>
        ) : null}
      </Box>

      <Tooltip title="View QR code" placement="left">
        <span style={{ position: "relative" }}>
          <IconButton
            aria-label="View QR code"
            onClick={() => setQrOpen(true)}
            disabled={!employeeId}
            size="small"
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1.125,
              backgroundColor: "background.paper",
              width: 36,
              height: 36,
            }}
          >
            <QrCode size={18} />
          </IconButton>
        </span>
      </Tooltip>

      <EmployeeQrDialog
        open={qrOpen}
        employeeId={employeeId}
        email={workEmail}
        onClose={() => setQrOpen(false)}
      />
    </Box>
  );
}
