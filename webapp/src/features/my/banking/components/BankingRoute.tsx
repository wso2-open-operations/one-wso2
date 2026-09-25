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
import { useBankingAccess } from "../../api/useBankingAccess";

/**
 * Closes the Banking routes to anyone outside the banking employee group.
 *
 * The rail entry is hidden for them, but a hidden entry alone leaves the URL
 * working; this is the route half. Same shape as SriLankaRoute: wait rather
 * than refuse while the token is still being read (an unresolved gate reads as
 * "not a member", and redirecting on that would bounce a real employee off the
 * page on every cold load), and treat a failed read as a failure with a retry,
 * not as a refusal.
 */
export default function BankingRoute({ children }: { children: ReactNode }): JSX.Element | null {
  const access = useBankingAccess();

  if (access.isResolving) return null;

  if (access.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={access.errorMessage} onRetry={access.retry}>
          Couldn&apos;t check your access to Banking.
        </ErrorNotice>
      </Box>
    );
  }

  // To Me, not to a refusal page: the rail is not offering this screen, so
  // there is nothing here to explain.
  if (!access.canSee) return <Navigate to="/me" replace />;

  return <>{children}</>;
}
