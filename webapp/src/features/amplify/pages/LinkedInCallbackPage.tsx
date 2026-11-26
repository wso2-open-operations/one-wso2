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
import { AMPLIFY_ADMIN_PATH, AMPLIFY_CELEBRATE_PATH, AMPLIFY_MY_POINTS_PATH } from "@constants/perspectives";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  useCompleteLinkedInConnect,
  useCompleteLinkedInPageConnect,
  useCompleteReachConnect,
} from "../api/useAmplifyMutations";
import { PAGE_CONNECTION_MESSAGES, REACH_MESSAGES, describeAmplifyError } from "../util/amplifyError";
import { forgetPageConnect, isPageConnectState, isReachState } from "../util/pageConnect";

/** The toast on Amplify Admin after the company page is connected. */
export const PAGE_CONNECTED_MESSAGE = "Connected to the Choreo Labs page.";

/** The toast on My points & Coins after the employee allows Reach. */
export const REACH_ON_MESSAGE = "Reach is on. Your reposts' reach shows here once LinkedIn reports it.";

/** Which flow came back: an employee's own link, the company page, or an employee's Reach consent. */
type Flow = "member" | "page" | "reach";

/** Where each flow goes back to, and what it says. */
interface FlowCopy {
  backTo: string;
  backLabel: string;
  denied: string;
  unfinished: string;
  working: string;
  /** Screen-specific error copy, checked before the shared messages. */
  messages?: Readonly<Record<string, string>>;
}

const COPY: Record<Flow, FlowCopy> = {
  member: {
    backTo: AMPLIFY_CELEBRATE_PATH,
    backLabel: "Back to Celebrate",
    denied: "LinkedIn wasn't linked. You can try again any time.",
    unfinished: "Connection didn't finish, try again.",
    working: "Linking your LinkedIn account…",
  },
  page: {
    backTo: AMPLIFY_ADMIN_PATH,
    backLabel: "Back to Amplify Admin",
    denied: "The Choreo Labs page wasn't connected. You can try again from Amplify Admin.",
    unfinished: "The page connection didn't finish, try again.",
    working: "Connecting the Choreo Labs page…",
    messages: PAGE_CONNECTION_MESSAGES,
  },
  reach: {
    backTo: AMPLIFY_MY_POINTS_PATH,
    backLabel: "Back to My points & Coins",
    denied: "Reach wasn't turned on. You can allow it any time from My points & Coins.",
    unfinished: "Reach didn't finish turning on, try again.",
    working: "Turning on reach…",
    messages: REACH_MESSAGES,
  },
};

// A relative portal path only, the same rule amplify-api puts on returnTo:
// no `//`, backslash or whitespace, so this can never redirect off-site.
function safeReturnTo(value: string | null | undefined): string {
  return value && /^\/([^/\\\s][^\\\s]*)?$/.test(value) ? value : AMPLIFY_CELEBRATE_PATH;
}

/**
 * Where LinkedIn sends the browser after consent (no rail row), for the three flows that come back here:
 *  - an employee linking their own account: posts the code and state to amplify-api, then returns to where the
 *    Amplify click started, which reopens that post's share dialog;
 *  - an admin connecting the company page from Amplify Admin (the state this tab remembered when it started):
 *    completes the page connection, then returns to Amplify Admin;
 *  - an employee allowing Reach (a state that starts `reach-`): completes it, then returns to My points & Coins.
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
  const { mutateAsync: completeReachConnect } = useCompleteReachConnect();
  const [failure, setFailure] = useState<unknown>(null);
  const code = params.get("code");
  const state = params.get("state");
  const denied = params.get("error");
  // Read once: the state is forgotten as soon as it is sent.
  const [flow] = useState<Flow>(() => (isReachState(state) ? "reach" : isPageConnectState(state) ? "page" : "member"));
  const page = flow === "page";
  const copy = COPY[flow];

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
    if (flow === "reach") {
      completeReachConnect({ code, state, redirectUri })
        .then(() => {
          showSuccess(REACH_ON_MESSAGE);
          navigate(AMPLIFY_MY_POINTS_PATH, { replace: true });
        })
        .catch(setFailure);
      return;
    }
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
  }, [flow, page, code, state, denied, completeConnect, completePageConnect, completeReachConnect, navigate, showSuccess]);

  const back = (
    <Button variant="outlined" onClick={() => navigate(copy.backTo, { replace: true })} sx={{ mt: 2 }}>
      {copy.backLabel}
    </Button>
  );

  if (denied || !code || !state) {
    return (
      <Box sx={{ p: 2, maxWidth: 560 }}>
        <ErrorNotice severity="info">{denied ? copy.denied : copy.unfinished}</ErrorNotice>
        {back}
      </Box>
    );
  }

  if (failure) {
    return (
      <Box sx={{ p: 2, maxWidth: 560 }}>
        <ErrorNotice>{describeAmplifyError(failure, copy.messages)}</ErrorNotice>
        {back}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, display: "flex", alignItems: "center", gap: 2 }}>
      <CircularProgress size={20} />
      <Typography>{copy.working}</Typography>
    </Box>
  );
}
