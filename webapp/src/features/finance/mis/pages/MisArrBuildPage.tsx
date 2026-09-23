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

import { Alert, Box, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import MisShell from "../components/MisShell";
import { useMisUserInfo } from "../api/useMisUserInfo";
import { MIS_PRIVILEGE, misHasPrivilege } from "../api/misTypes";

// ARR Build — the annual recurring-revenue Build. The table itself lands in
// ticket 06; this is the tracer bullet that proves the route in front of it.
//
// What it renders for now is the answer to the one question the whole port
// rests on: does One WSO2's Asgardeo token reach the MIS gateway at all? The
// two services are separate SPA clients in the same tenant, MIS sits in the
// same Choreo project as backends this app already calls, and unauthenticated
// probes return 401 exactly as those do — so everything except the token is
// confirmed. Only a real signed-in call settles the rest, and this is the
// screen that makes it. See docs/ported-apps/mis.md §11.1 and §11.4.
export default function MisArrBuildPage() {
  useDocumentTitle("ARR Build");

  return (
    <MisShell
      gateId="mis-arr-build"
      title="ARR Build"
      subtitle="Annual recurring revenue from an opening balance to a closing balance, one column per period."
    >
      <PrivilegeReadout />
    </MisShell>
  );
}

// Deliberately temporary, and deliberately explicit: it prints what /user-info
// actually returned rather than only what was concluded from it. Ticket 06
// replaces this with the Build table, and the finding it produces goes into the
// spec before that happens.
function PrivilegeReadout() {
  const userInfo = useMisUserInfo();
  const privileges = userInfo.data?.privileges;
  const hasArr = misHasPrivilege(userInfo.data, MIS_PRIVILEGE.ARR_DASHBOARD);
  const hasFlash = misHasPrivilege(userInfo.data, MIS_PRIVILEGE.FLASH_DASHBOARD);

  return (
    <Box sx={{ mt: 1.5 }}>
      <Alert severity="success" sx={{ mb: 2 }}>
        The MIS ARR backend accepted this session's token and answered{" "}
        <code>GET /user-info</code>. That is what this screen exists to establish;
        the Build table itself is still to come.
      </Alert>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        What it returned for you
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Chip
          size="small"
          variant="outlined"
          color={hasArr ? "success" : "default"}
          label={`ARR dashboards (${MIS_PRIVILEGE.ARR_DASHBOARD}) — ${hasArr ? "granted" : "not granted"}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={hasFlash ? "success" : "default"}
          label={`Flash Dashboard (${MIS_PRIVILEGE.FLASH_DASHBOARD}) — ${hasFlash ? "granted" : "not granted"}`}
        />
      </Stack>

      {/* The raw array, because the shape is itself part of what is being
          established — whether a non-MIS employee gets 200 with an empty array
          or a 403 decides whether the gate can show an honest locked state or
          has to treat a denial as absence (§11.4). */}
      <Typography variant="body2" color="text.secondary">
        Raw <code>privileges</code>:{" "}
        <code>{Array.isArray(privileges) ? JSON.stringify(privileges) : "not an array"}</code>
      </Typography>
    </Box>
  );
}
