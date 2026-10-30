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
import { AMPLIFY_CELEBRATE_PATH } from "@constants/perspectives";
import { useCompleteLinkedInConnect } from "../api/useAmplifyMutations";
import { describeAmplifyError } from "../util/amplifyError";

// A relative One WSO2 path only, the same rule amplify-api puts on returnTo:
// no `//`, backslash or whitespace, so this can never redirect off-site.
function safeReturnTo(value: string | null | undefined): string {
  return value && /^\/([^/\\\s][^\\\s]*)?$/.test(value) ? value : AMPLIFY_CELEBRATE_PATH;
}

/**
 * Where LinkedIn sends the browser after consent (no rail row). Posts the
 * code and state to amplify-api, then returns to where the Amplify click
 * started, which reopens that post's share dialog.
 *
 * Open item D4: confirm the Asgardeo SDK doesn't read `?code=&state=` on this
 * route as its own sign-in callback.
 */
export default function LinkedInCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { mutateAsync: completeConnect } = useCompleteLinkedInConnect();
  const [failure, setFailure] = useState<unknown>(null);
  const code = params.get("code");
  const state = params.get("state");
  const denied = params.get("error");

  // Once per page load: a state is single-use, and StrictMode runs effects twice.
  // Awaits the promise rather than passing callbacks to `mutate`: React Query
  // drops those when the observer unsubscribes, which StrictMode's
  // mount-unmount-mount does in dev, leaving the page spinning after a 200.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !code || !state || denied) return;
    sent.current = true;
    completeConnect({ code, state, redirectUri: `${window.location.origin}${window.location.pathname}` })
      .then((conn) => navigate(safeReturnTo(conn?.returnTo), { replace: true }))
      .catch(setFailure);
  }, [code, state, denied, completeConnect, navigate]);

  const backToCelebrate = (
    <Button variant="outlined" onClick={() => navigate(AMPLIFY_CELEBRATE_PATH, { replace: true })} sx={{ mt: 2 }}>
      Back to Celebrate
    </Button>
  );

  if (denied || !code || !state) {
    return (
      <Box sx={{ p: 2, maxWidth: 560 }}>
        <ErrorNotice severity="info">
          {denied ? "LinkedIn wasn't linked. You can try again any time." : "Connection didn't finish, try again."}
        </ErrorNotice>
        {backToCelebrate}
      </Box>
    );
  }

  if (failure) {
    return (
      <Box sx={{ p: 2, maxWidth: 560 }}>
        <ErrorNotice>{describeAmplifyError(failure)}</ErrorNotice>
        {backToCelebrate}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, display: "flex", alignItems: "center", gap: 2 }}>
      <CircularProgress size={20} />
      <Typography>Linking your LinkedIn account…</Typography>
    </Box>
  );
}
