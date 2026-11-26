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

import { useNotifications } from "@context/notifications/NotificationsContext";
import { useAmplifyConfig } from "./useAmplifyData";
import { useDisconnectReach, useStartReachConnect } from "./useAmplifyMutations";
import { REACH_MESSAGES, describeAmplifyError } from "../util/amplifyError";
import { isAllowedLink } from "../util/linkedinPost";

/** The toast after Turn off reach. */
export const REACH_OFF_MESSAGE = "Reach is off. Amplify no longer reads your posts' analytics.";

/** What `DEPENDENCY_UNAVAILABLE` means on Turn off: LinkedIn didn't confirm, so reach stays on. */
export const REACH_OFF_UNAVAILABLE = "LinkedIn couldn't be reached, so reach is still on. Try again shortly.";

/**
 * Turning Reach on and off. On: POST /me/connections/reach/start, then the browser goes to LinkedIn (only to an
 * allowed LinkedIn origin) and comes back to /amplify/connect/callback. Off: DELETE /me/connections/reach.
 */
export function useReachToggle(): { turnOn: () => Promise<void>; turnOff: () => Promise<void>; busy: boolean } {
  const start = useStartReachConnect();
  const disconnect = useDisconnectReach();
  const { campaignLinkOrigins } = useAmplifyConfig();
  const { showError, showSuccess } = useNotifications();

  const turnOn = async () => {
    try {
      const auth = await start.mutateAsync();
      if (!auth?.authorizationUrl || !isAllowedLink(auth.authorizationUrl, campaignLinkOrigins)) {
        showError(describeAmplifyError(null));
        return;
      }
      window.location.assign(auth.authorizationUrl);
    } catch (err) {
      showError(describeAmplifyError(err, REACH_MESSAGES));
    }
  };

  const turnOff = async () => {
    try {
      await disconnect.mutateAsync();
      showSuccess(REACH_OFF_MESSAGE);
    } catch (err) {
      showError(describeAmplifyError(err, { DEPENDENCY_UNAVAILABLE: REACH_OFF_UNAVAILABLE }));
    }
  };

  return { turnOn, turnOff, busy: start.isPending || disconnect.isPending };
}
