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

import type { ComponentProps } from "react";
import { AsgardeoProvider } from "@asgardeo/react";
import { authConfig } from "@config/authConfig";

/**
 * Sign-in against ThunderID (or any OIDC server that doesn't follow Asgardeo's
 * URL layout). Chosen by AppWithConfig when ONE_WSO2_AUTH_WELL_KNOWN_URL is set;
 * Asgardeo deployments keep the stock AsgardeoProvider.
 *
 * Still the Asgardeo SDK underneath, so every `useAsgardeo()` in the app keeps
 * working. The one difference is the discovery document: without it the SDK
 * derives Asgardeo's endpoints from baseUrl and expects the issuer to be
 * `{baseUrl}/oauth2/token`, so it rejects ThunderID's tokens (issuer
 * `{baseUrl}`) and sign-in never completes.
 *
 * The SDK core reads a flat `wellKnownEndpoint` (loadOpenIDProviderConfiguration
 * in @asgardeo/javascript) and the provider forwards props it doesn't name into
 * that config. This SDK's prop types don't declare it, hence the spread.
 */
export default function ThunderProvider(props: ComponentProps<typeof AsgardeoProvider>) {
  const discovery = authConfig.wellKnownEndpoint ? { wellKnownEndpoint: authConfig.wellKnownEndpoint } : {};
  return <AsgardeoProvider {...props} {...discovery} />;
}
