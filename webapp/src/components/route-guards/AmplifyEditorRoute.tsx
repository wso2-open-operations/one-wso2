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

import type { JSX, ReactNode } from "react";
import { Box } from "@wso2/oxygen-ui";
import { Navigate } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAmplifyEditorAccess } from "@features/amplify/api/useAmplifyEditorAccess";
import { AMPLIFY_CELEBRATE_PATH } from "@constants/perspectives";

/**
 * Closes New Post and Current Posts to everyone amplify-api doesn't grant
 * `CAN_CAMPAIGN` (GET /me), at the route. The rail already hides the rows; this
 * stops a typed or bookmarked URL. Same rules as SriLankaRoute: wait while /me
 * loads, say so when the check fails, and send everyone else to Celebrate.
 */
export default function AmplifyEditorRoute({ children }: { children: ReactNode }): JSX.Element | null {
  const { hasAccess, isResolving, error, retry } = useAmplifyEditorAccess();

  if (isResolving) return null;

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice onRetry={retry}>Couldn&apos;t check your access.</ErrorNotice>
      </Box>
    );
  }

  if (!hasAccess) return <Navigate to={AMPLIFY_CELEBRATE_PATH} replace />;

  return <>{children}</>;
}
