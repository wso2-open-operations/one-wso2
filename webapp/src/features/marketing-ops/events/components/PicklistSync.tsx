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

// Settings → Events, bottom: pick list columns whose values are Salesforce's (Industry).
//
// Unlike the countries, nothing refreshes these on its own: Salesforce's list rarely
// changes, and a sync replaces values an admin may have edited by hand on a status. So
// it is a button an admin presses after the list changes in Salesforce.

import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { RefreshCwIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { usePicklistStatus, useSyncPicklists } from "../../api/useEvents";
import type { PicklistSyncStatus } from "../eventsTypes";
import { sinceText } from "../lib/geography";
import { describeEventsError } from "../lib/serverError";
import { quietBtn } from "./eventsStyles";

/** "28 values on 5 statuses. Synced 2 days ago by …" */
function summary(p: PicklistSyncStatus): string {
  const counts = `${p.value_count} values on ${p.column_count} status${p.column_count === 1 ? "" : "es"}.`;
  if (!p.synced_at) return `${counts} Not synced from Salesforce yet.`;
  const who = p.synced_by ? ` by ${p.synced_by}` : "";
  return `${counts} Synced ${sinceText(p.synced_at)}${who}.`;
}

/** The last attempt failed and nothing has succeeded since. */
function failure(p: PicklistSyncStatus): string | null {
  if (!p.error || !p.attempted_at) return null;
  if (p.synced_at && new Date(p.synced_at) >= new Date(p.attempted_at)) return null;
  return `The last sync, ${sinceText(p.attempted_at)}, failed: ${p.error} The current values are still in use.`;
}

export default function PicklistSync() {
  const status = usePicklistStatus();
  const sync = useSyncPicklists();
  const items = status.data ?? [];
  // The attempt just made, when it failed, says why itself: a recorded failure may be an
  // earlier one, so those show only when there is no fresher answer.
  const failures = sync.isError ? [] : items.map(failure).filter((f): f is string => !!f);
  const names = items.map((p) => p.field_name).join(", ") || "Industry";

  return (
    <Box sx={{ mt: 4, pt: 3, borderTop: "1px solid", borderColor: "divider", maxWidth: 800 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>{names} from Salesforce</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
        {names} is a pick list in Salesforce, and the column here uses the same values on every
        status. When the list changes in Salesforce, sync it here. Syncing replaces the values on
        every status, including any edited by hand above.
      </Typography>

      {status.isError ? (
        <Alert severity="error" sx={{ fontSize: 12.5, mb: 1.5 }}>
          Could not load the sync status. {describeError(status.error)}
        </Alert>
      ) : !status.data ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <CircularProgress size={14} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading…</Typography>
        </Stack>
      ) : (
        <>
          {items.map((p) => (
            <Typography key={p.field_name} sx={{ fontSize: 13, mb: 1 }}>
              <b>{p.field_name}</b>: {summary(p)}
            </Typography>
          ))}
          {failures.map((f) => (
            <Alert key={f} severity="warning" sx={{ fontSize: 12.5, mb: 1.5 }}>
              {f}
            </Alert>
          ))}
        </>
      )}

      {sync.isError && (
        <Alert severity="error" sx={{ fontSize: 12.5, mb: 1.5 }}>
          {describeEventsError(sync.error)}
        </Alert>
      )}

      <Button
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
        size="small"
        startIcon={sync.isPending ? <CircularProgress size={14} /> : <RefreshCwIcon size={15} />}
        sx={quietBtn}
      >
        {sync.isPending ? "Syncing from Salesforce…" : "Sync from Salesforce"}
      </Button>
    </Box>
  );
}
