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

import { Suspense, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAsgardeo } from "@asgardeo/react";
import { Alert, Box, CircularProgress, Link } from "@wso2/oxygen-ui";
import { exchangeTokens, type ExchangedTokens, type TokenExchangeRequest } from "@api/tokenExchange";
import { CSM_BASE_PATH, csmRemoteEntryUrl, csmUrl } from "@config/apiConfig";
import { landingPath, landingPathFor } from "@config/landingConfig";
import { remoteComponent } from "@/remotes/remoteComponent";
import RemoteBoundary from "@/remotes/RemoteBoundary";

/**
 * Where "Back to One WSO2" goes: the person's landing page, unless that is CSM
 * itself, in which case the link would lead straight back here.
 */
function exitPath(): string {
  const landing = landingPath();
  const isCsm = landing === CSM_BASE_PATH || landing.startsWith(`${CSM_BASE_PATH}/`);
  return isCsm ? landingPathFor(undefined) : landing;
}

// What CSM's exposed component accepts. Kept in step by hand with
// RemoteEntry.tsx in the CSM portal, since the two are built separately.
interface CsmRemoteProps {
  basename: string;
  host: {
    name: string;
    onExit: () => void;
    /** Tokens for CSM's own client id, exchanged from this app's. */
    getTokens: (request: TokenExchangeRequest) => Promise<ExchangedTokens>;
  };
}

const CsmRemote = csmRemoteEntryUrl ? remoteComponent<CsmRemoteProps>("csm", csmRemoteEntryUrl, "App") : null;

/**
 * The CSM portal, loaded from its own deployment. It takes over the whole page
 * with its own header and sidebar, and shows a link back here. It shares this
 * app's sign-in, so it shows no login of its own.
 */
export default function CsmRemotePage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAsgardeo();
  const host = useMemo(
    () => ({
      name: "One WSO2",
      onExit: () => navigate(exitPath()),
      // CSM says which client id and scopes it needs; this app's own token is
      // never handed to it.
      getTokens: (request: TokenExchangeRequest) => exchangeTokens(request, getAccessToken),
    }),
    [navigate, getAccessToken],
  );
  if (!CsmRemote) {
    return <Alert severity="info">CSM is not connected: ONE_WSO2_CSM_REMOTE_ENTRY_URL is not set.</Alert>;
  }
  return (
    <RemoteBoundary
      fallback={(error) => (
        <Alert severity="error">
          CSM could not be loaded ({error.message}).
          {csmUrl && (
            <>
              {" "}
              <Link href={csmUrl} target="_blank" rel="noopener noreferrer">
                Open CSM in a new tab
              </Link>
            </>
          )}
        </Alert>
      )}
    >
      <Suspense
        fallback={
          <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
            <CircularProgress />
          </Box>
        }
      >
        <CsmRemote basename={CSM_BASE_PATH} host={host} />
      </Suspense>
    </RemoteBoundary>
  );
}
