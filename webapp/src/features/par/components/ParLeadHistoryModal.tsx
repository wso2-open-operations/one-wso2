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

import { useMemo } from "react";
import { Avatar, Chip, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography } from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import ParEmployeeHistoryView from "./ParEmployeeHistoryView";

// par-app's Review.tsx: "PAR HISTORY" opens EmployeeHistoryCard in a real
// modal (CustomModal). This wraps the shared content (ParEmployeeHistoryView)
// in that Dialog.
export default function ParLeadHistoryModal({
  open,
  onClose,
  employeeEmail,
  employeeName,
}: {
  open: boolean;
  onClose: () => void;
  employeeEmail: string;
  employeeName: string;
}) {
  const thumbnails = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(thumbnails.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [thumbnails.data],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h6" component="span">
            Employee History
          </Typography>
          <Chip
            label={employeeName}
            avatar={
              <Avatar src={thumbnailByEmail.get(employeeEmail)} slotProps={{ img: { referrerPolicy: "no-referrer" } }} />
            }
          />
        </Stack>
        <IconButton onClick={onClose} aria-label="close">
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <ParEmployeeHistoryView employeeEmail={employeeEmail} employeeName={employeeName} />
      </DialogContent>
    </Dialog>
  );
}
