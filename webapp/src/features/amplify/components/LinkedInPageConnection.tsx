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

import { Box, Button, LinearProgress, Skeleton, Typography, alpha, type Theme } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useAmplifyConfig, useLinkedInPage } from "../api/useAmplifyData";
import { useDisconnectLinkedInPage, useStartLinkedInPageConnect } from "../api/useAmplifyMutations";
import { PAGE_CONNECTION_MESSAGES, PAGE_DISCONNECT_UNAVAILABLE, describeAmplifyError } from "../util/amplifyError";
import { num } from "../util/dashboardFormat";
import { isAllowedLink } from "../util/linkedinPost";
import { callsPercent, connectedByText, rememberPageConnect } from "../util/pageConnect";
import { AMPLIFY_RADIUS } from "../util/radius";

/** The toast after Disconnect. */
export const PAGE_DISCONNECTED_MESSAGE = "Disconnected from the Choreo Labs page. Amplify stops reading it.";

/** The line under LinkedIn calls today. */
export const CALLS_HELP = "Reactions, comments and reposts are read on a schedule within this daily limit.";

/**
 * Amplify Admin's LinkedIn page connection (design 07, CAN_ADMIN): who connected the Choreo Labs page and when, with
 * Disconnect, or Connect when it isn't connected (an expired or disconnected page names who connected it last), and
 * today's LinkedIn calls against `engagement.daily_call_budget`. Connect goes to LinkedIn and comes back to
 * /amplify/connect/callback, which finishes it and returns here.
 */
export default function LinkedInPageConnection() {
  const page = useLinkedInPage();
  const start = useStartLinkedInPageConnect();
  const disconnect = useDisconnectLinkedInPage();
  const { campaignLinkOrigins } = useAmplifyConfig();
  const { showError, showSuccess } = useNotifications();
  const busy = start.isPending || disconnect.isPending;

  if (page.isPending) return <Skeleton variant="rounded" height={140} />;
  if (page.isError) {
    return (
      <ErrorNotice error={page.error} onRetry={() => void page.refetch()} retrying={page.isFetching}>
        Couldn&apos;t load the page connection.
      </ErrorNotice>
    );
  }
  const status = page.data;

  const connect = async () => {
    try {
      const auth = await start.mutateAsync();
      if (!auth?.authorizationUrl || !isAllowedLink(auth.authorizationUrl, campaignLinkOrigins)) {
        showError(describeAmplifyError(null));
        return;
      }
      rememberPageConnect(auth.state);
      window.location.assign(auth.authorizationUrl);
    } catch (err) {
      showError(describeAmplifyError(err, PAGE_CONNECTION_MESSAGES));
    }
  };

  const disconnectPage = async () => {
    try {
      await disconnect.mutateAsync();
      showSuccess(PAGE_DISCONNECTED_MESSAGE);
    } catch (err) {
      showError(describeAmplifyError(err, { DEPENDENCY_UNAVAILABLE: PAGE_DISCONNECT_UNAVAILABLE }));
    }
  };

  const tone = status.connected ? "success" : "warning";
  return (
    <Box>
      <Box
        role="status"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
          border: "1px solid",
          borderRadius: AMPLIFY_RADIUS,
          px: 2,
          py: 1.5,
          bgcolor: (t: Theme) => alpha(t.palette[tone].main, 0.08),
          borderColor: (t: Theme) => alpha(t.palette[tone].main, 0.35),
        }}
      >
        <Box
          aria-hidden="true"
          sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: status.connected ? "success.main" : "warning.main", flexShrink: 0 }}
        />
        <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
            {status.connected ? "Connected to the Choreo Labs page" : "Not connected to the Choreo Labs page"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {status.connected
              ? connectedByText(status)
              : status.connectedByName
                ? `Last connected by ${status.connectedByName}. A page admin connects it again so Amplify can read reactions, comments and reposts.`
                : "A page admin connects it so Amplify can read reactions, comments and reposts."}
          </Typography>
        </Box>
        {status.connected ? (
          <Button variant="outlined" color="error" onClick={() => void disconnectPage()} disabled={busy}>
            {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : (
          <Button variant="contained" onClick={() => void connect()} disabled={busy}>
            {start.isPending ? "Connecting…" : status.connectedByName ? "Connect again" : "Connect"}
          </Button>
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mb: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>LinkedIn calls today</Typography>
          <Typography>
            {num(status.callsToday)} of {num(status.dailyBudget)}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          color="info"
          value={callsPercent(status.callsToday, status.dailyBudget)}
          aria-label="LinkedIn calls today"
          sx={{ height: 6, borderRadius: 2 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {CALLS_HELP}
        </Typography>
      </Box>
    </Box>
  );
}
