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

import { Fab, Tooltip } from "@wso2/oxygen-ui";
import { Sparkles } from "@wso2/oxygen-ui-icons-react";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { fetchStarters, type AssistantHub } from "./dashboardAgentApi";
import DashboardAgentDialog from "./DashboardAgentDialog";

// The floating "Ask AI" button for a hub (the Risk Hub by default). It renders
// nothing unless the backend says the assistant is available to this user:
// switched off, an external auditor, or someone with no access to that hub's data
// all get nothing here.
//
// It sits above the page's bottom-right corner, clear of the footer and of the
// assistant bubble that shares that corner.
export default function DashboardAgentLauncher({ hub = "risk" }: { hub?: AssistantHub }): JSX.Element | null {
  const authFetch = useAuthApiClient();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchStarters(authFetch, hub).then((s) => {
      if (!cancelled) setAvailable(s !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch, hub]);

  if (!available) return null;
  return (
    <>
      <Tooltip title="Ask AI" placement="left">
        <Fab
          color="primary"
          aria-label="Ask AI"
          onClick={() => setOpen(true)}
          sx={{ position: "fixed", bottom: 96, right: 28, zIndex: 1200 }}
        >
          <Sparkles size={22} />
        </Fab>
      </Tooltip>
      <DashboardAgentDialog open={open} onClose={() => setOpen(false)} hub={hub} />
    </>
  );
}
