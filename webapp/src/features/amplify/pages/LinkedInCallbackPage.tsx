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

import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@wso2/oxygen-ui";
import { useNavigate, useSearchParams } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { AMPLIFY_ADMIN_PATH, AMPLIFY_CELEBRATE_PATH } from "@constants/perspectives";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useCompleteLinkedInConnect, useCompleteLinkedInPageConnect } from "../api/useAmplifyMutations";
import { PAGE_CONNECTION_MESSAGES, describeAmplifyError } from "../util/amplifyError";
import { forgetPageConnect, isPageConnectState } from "../util/pageConnect";

/** The toast on Amplify Admin after the company page is connected. */
export const PAGE_CONNECTED_MESSAGE = "Connected to the Choreo Labs page.";

// A relative portal path only, the same rule amplify-api puts on returnTo:
// no `//`, backslash or whitespace, so this can never redirect off-site.
function safeReturnTo(value: string | null | undefined): string {
  return value && /^\/([^/\\\s][^\\\s]*)?$/.test(value) ? value : AMPLIFY_CELEBRATE_PATH;
}

/**
 * Where LinkedIn sends the browser after consent (no rail row), for both flows that come back here:
 *  - an employee linking their own account: posts the code and state to amplify-api, then returns to where the
 *    Amplify click started, which reopens that post's share dialog;
 *  - an admin connecting the company page from Amplify Admin (the state this tab remembered when it started):
 *    completes the page connection, then returns to Amplify Admin.
 *
 * Open item D4: confirm the Asgardeo SDK doesn't read `?code=&state=` on this
 * route as its own sign-in callback.
 */
export default function LinkedInCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { showSuccess } = useNotifications();
  const { mutateAsync: completeConnect } = useCompleteLinkedInConnect();
  const { mutateAsync: completePageConnect } = useCompleteLinkedInPageConnect();
  const [failure, setFailure] = useState<unknown>(null);
  const code = params.get("code");
  const state = params.get("state");
  const denied = params.get("error");
  // Read once: the state is forgotten as soon as it is sent.
  const [page] = useState(() => isPageConnectState(state));

  // Once per page load: a state is single-use, and StrictMode runs effects twice.
  // Awaits the promise rather than passing callbacks to `mutate`: React Query
  // drops those when the observer unsubscribes, which StrictMode's
  // mount-unmount-mount does in dev, leaving the page spinning after a 200.
  const sent = useRef(false);
  useEffect(() => {
    if (page) forgetPageConnect();
    if (sent.current || !code || !state || denied) return;
    sent.current = true;
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    if (page) {
      completePageConnect({ code, state, redirectUri })
        .then(() => {
          showSuccess(PAGE_CONNECTED_MESSAGE);
          navigate(AMPLIFY_ADMIN_PATH, { replace: true });
        })
        .catch(setFailure);
      return;
    }
    completeConnect({ code, state, redirectUri })
      .then((conn) => navigate(safeReturnTo(conn?.returnTo), { replace: true }))
      .catch(setFailure);
  }, [page, code, state, denied, completeConnect, completePageConnect, navigate, showSuccess]);

  const back = page ? (
    <Button variant="outlined" onClick={() => navigate(AMPLIFY_ADMIN_PATH, { replace: true })} sx={{ mt: 2 }}>
      Back to Amplify Admin
    </Button>
  ) : (
    <Button variant="outlined" onClick={() => navigate(AMPLIFY_CELEBRATE_PATH, { replace: true })} sx={{ mt: 2 }}>
      Back to Celebrate
    </Button>
  );

  if (denied || !code || !state) {
    const message = page
      ? denied
        ? "The Choreo Labs page wasn't connected. You can try again from Amplify Admin."
        : "The page connection didn't finish, try again."
      : denied
        ? "LinkedIn wasn't linked. You can try again any time."
        : "Connection didn't finish, try again.";
    return (
      <Box sx={{ p: 2, maxWidth: 560 }}>
        <ErrorNotice severity="info">{message}</ErrorNotice>
        {back}
      </Box>
    );
  }

  if (failure) {
    return (
      <Box sx={{ p: 2, maxWidth: 560 }}>
        <ErrorNotice>{describeAmplifyError(failure, page ? PAGE_CONNECTION_MESSAGES : undefined)}</ErrorNotice>
        {back}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, display: "flex", alignItems: "center", gap: 2 }}>
      <CircularProgress size={20} />
      <Typography>{page ? "Connecting the Choreo Labs page…" : "Linking your LinkedIn account…"}</Typography>
    </Box>
  );
}
