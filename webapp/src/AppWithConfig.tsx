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

import { lazy, Suspense, useEffect } from "react";
import { AsgardeoProvider, useAsgardeo } from "@asgardeo/react";
import ThunderProvider from "@context/auth/ThunderProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { authConfig } from "@config/authConfig";
import { ThemePreferenceProvider } from "@context/theme/ThemePreferenceContext";
import { PerspectiveProvider } from "@context/perspective/PerspectiveContext";
import { NotificationsProvider } from "@context/notifications/NotificationsContext";
import { HttpError } from "@api/http";
import { registerAuthAccessors } from "@api/authBridge";
import { isSilentSignInFrame } from "@api/silentSignInFrame";
import App from "./App";

// Read once: a document does not move between frames.
const inSilentSignInFrame = isSilentSignInFrame();

// Registers the live getIdToken/getAccessToken/signInSilently into
// @api/authBridge so http.ts's 401 → silent-reauth → retry path (access_token)
// and useAsgardeoSub's decode-failure → retry path (id_token) both have
// something to call. Renders nothing; must live inside <AsgardeoProvider>.
function AuthBridgeMount() {
  const { getIdToken, getAccessToken, signInSilently } = useAsgardeo();
  useEffect(() => {
    registerAuthAccessors({ getIdToken, getAccessToken, signInSilently });
  }, [getIdToken, getAccessToken, signInSilently]);
  return null;
}

// Query devtools are a development-only aid — never ship them to production,
// where they would expose the cached profile / finance / leave / banking data
// to the signed-in user. Lazy + DEV-gated so the package is dead-code
// eliminated from the production bundle entirely (not just hidden).
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;

// One shared QueryClient — retry only on transient upstream errors. All
// HTTP failures the app throws are HttpError (see @features/my/api), so we
// key the check off the class + .status rather than a fragile regex on the
// message. Non-HttpError throws (e.g. network offline) also retry.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        if (error instanceof HttpError) return error.status === 502 || error.status === 503;
        return true;
      },
    },
  },
});

// ThunderID (and other servers outside Asgardeo's URL layout) sign in through
// ThunderProvider, picked when a discovery URL is configured. Asgardeo
// deployments set no such URL and keep the stock provider.
const AuthProvider = authConfig.wellKnownEndpoint ? ThunderProvider : AsgardeoProvider;

export default function AppWithConfig() {
  return (
    <AuthProvider
      baseUrl={authConfig.baseUrl}
      clientId={authConfig.clientId}
      afterSignInUrl={authConfig.afterSignInUrl}
      afterSignOutUrl={authConfig.afterSignOutUrl}
      scopes={[...authConfig.scopes]}
      preferences={{
        theme: { inheritFromBranding: false },
        user: { fetchUserProfile: false, fetchOrganizations: false },
      }}
    >
      {/* In the SDK's silent sign-in iframe only the provider runs — see isSilentSignInFrame. */}
      {inSilentSignInFrame ? null : (
        <>
          <AuthBridgeMount />
          <QueryClientProvider client={queryClient}>
            <ThemePreferenceProvider>
              <BrowserRouter>
                <PerspectiveProvider>
                  <NotificationsProvider>
                    <App />
                  </NotificationsProvider>
                </PerspectiveProvider>
              </BrowserRouter>
            </ThemePreferenceProvider>
            {ReactQueryDevtools && (
              <Suspense fallback={null}>
                <ReactQueryDevtools initialIsOpen={false} />
              </Suspense>
            )}
          </QueryClientProvider>
        </>
      )}
    </AuthProvider>
  );
}
