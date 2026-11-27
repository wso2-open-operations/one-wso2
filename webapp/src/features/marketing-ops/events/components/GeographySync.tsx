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

// Settings → Events, bottom: the country and state lists every lead is checked against.
//
// They are a copy of Salesforce's, not something edited here. Salesforce's country and
// state picklists are restricted, so a state added only in MOP would pass the check and
// then be refused by Salesforce — a missing state is added in Salesforce Setup, then
// synced. The server refreshes the copy once a day on its own; Sync now is for "I just
// changed it in Salesforce".

import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { RefreshCwIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useGeographyStatus, useSyncGeography } from "../../api/useEvents";
import { failureText, freshnessText } from "../lib/geography";
import { describeEventsError } from "../lib/serverError";
import { quietBtn } from "./eventsStyles";

export default function GeographySync() {
  const status = useGeographyStatus();
  const sync = useSyncGeography();
  const s = status.data;
  // The attempt just made, when it failed, says why itself: a recorded failure may be an
  // earlier one, so it shows only when there is no fresher answer.
  const failure = s && !sync.isError ? failureText(s) : null;

  return (
    <Box sx={{ mt: 4, pt: 3, borderTop: "1px solid", borderColor: "divider", maxWidth: 800 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>Countries & states</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
        Every lead's country and state is checked against Salesforce's own lists, because
        Salesforce refuses a value that isn't on them. The copy here refreshes once a day. If a
        state is missing, add it in Salesforce Setup first, then sync — a value added only here
        would still be refused when the list is pushed.
      </Typography>

      {status.isError ? (
        <Alert severity="error" sx={{ fontSize: 12.5, mb: 1.5 }}>
          Could not load the sync status. {describeError(status.error)}
        </Alert>
      ) : !s ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <CircularProgress size={14} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading…</Typography>
        </Stack>
      ) : (
        <>
          <Typography sx={{ fontSize: 13, mb: 1 }}>
            <b>{s.country_count}</b> countries · <b>{s.state_count}</b> states in{" "}
            {s.countries_with_states.length} countries. {freshnessText(s)}
          </Typography>
          {s.countries_with_states.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
              {s.countries_with_states.map((c) => (
                <Chip
                  key={c.country}
                  size="small"
                  variant="outlined"
                  label={`${c.country} · ${c.states}`}
                  sx={{ fontSize: 12 }}
                />
              ))}
            </Stack>
          )}
          {failure && (
            <Alert severity="warning" sx={{ fontSize: 12.5, mb: 1.5 }}>
              {failure}
            </Alert>
          )}
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
        {sync.isPending ? "Syncing from Salesforce…" : "Sync now"}
      </Button>
    </Box>
  );
}
