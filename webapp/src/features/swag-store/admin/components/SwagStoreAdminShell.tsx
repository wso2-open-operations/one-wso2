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

import type { JSX } from "react";
import { Outlet } from "react-router";
import { Alert, Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { ShoppingBagIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { NothingHere, PageTitle } from "@components/perspective-landing/PerspectiveLanding";
import { isSwagStoreBackendConfigured } from "@config/apiConfig";
import { swagStoreAccess } from "../../api/swagStoreAccess";
import { useSwagStoreUserInfo } from "../../api/useSwagStoreUserInfo";
import { isOutsideWso2 } from "../../util/swagStoreError";

const NAME = "Swag Store";

/**
 * The frame every admin route renders in. Same ladder as the shop's shell:
 *
 *   not configured -> name the key to set; nothing is asked.
 *   checking       -> hold the page; nothing is redirected while resolving.
 *   check failed   -> an error with Retry, never presented as "no access".
 *   outside WSO2   -> the shared "Nothing here for you yet" card.
 *   no store role  -> says the screens are for the store team, and who grants access.
 *   store admin    -> the page. Each leaf checks its own role (SwagStoreAdminRequires).
 */
export default function SwagStoreAdminShell(): JSX.Element {
  const me = useSwagStoreUserInfo();

  if (!isSwagStoreBackendConfigured()) {
    return (
      <Box>
        <PageTitle label={NAME} />
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {NAME} isn&apos;t connected yet. Set <code>ONE_WSO2_SWAG_STORE_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> and reload.
        </Alert>
      </Box>
    );
  }

  // isPending as well as isLoading: while the caller's identity is still
  // resolving the query is disabled, which React Query reports as pending only.
  if (me.isPending || me.isLoading) {
    return (
      <Box>
        <PageTitle label={NAME} />
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Checking your {NAME} access…
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (me.isError && isOutsideWso2(me.error)) {
    return (
      <Box>
        <PageTitle label={NAME} />
        <NothingHere label={NAME} icon={ShoppingBagIcon} />
      </Box>
    );
  }

  if (me.isError) {
    return (
      <Box>
        <PageTitle label={NAME} />
        <ErrorNotice onRetry={() => void me.refetch()} error={me.error} sx={{ mt: 1.5 }}>
          Couldn&apos;t check your {NAME} access.
        </ErrorNotice>
      </Box>
    );
  }

  if (!swagStoreAccess(me.data).isAdmin) {
    return (
      <Box>
        <PageTitle label={NAME} />
        <Alert severity="info" sx={{ mt: 1.5, maxWidth: 620 }}>
          These screens are for the Swag Store team: catalog managers and fulfilment ops. People Ops grants access.
        </Alert>
      </Box>
    );
  }

  return <Outlet />;
}
