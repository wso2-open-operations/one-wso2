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

import { useState, type ReactNode } from "react";
import { ButtonBase } from "@wso2/oxygen-ui";
import { useAmplifyDashboardAccess } from "../api/useAmplifyEditorAccess";
import DashboardPopups, { type PopupView } from "../pages/dashboards/DashboardPopups";

/**
 * A post's title. For anyone granted `CAN_DASHBOARD` it is a button (no underline) that opens that post's popup,
 * the same one Post Performance shows; everyone else gets plain text.
 */
export default function PostLink({ campaignId, children }: { campaignId: string; children: ReactNode }) {
  const access = useAmplifyDashboardAccess();
  const [view, setView] = useState<PopupView>(null);
  if (!access.hasAccess) return <>{children}</>;
  return (
    <>
      <ButtonBase
        onClick={() => setView({ kind: "post", campaignId })}
        aria-haspopup="dialog"
        sx={{ font: "inherit", color: "inherit", textAlign: "left", "&:hover, &:focus-visible": { color: "primary.main" } }}
      >
        {children}
      </ButtonBase>
      <DashboardPopups view={view} onView={setView} />
    </>
  );
}
