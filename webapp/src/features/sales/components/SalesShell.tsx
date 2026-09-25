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

import type { ReactNode } from "react";
import { Alert, Box } from "@wso2/oxygen-ui";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { NothingHere, PageTitle } from "@components/perspective-landing/PerspectiveLanding";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";

/**
 * Page frame for Echo: the heading, and the two whole-page states that must
 * pre-empt the content rather than sit inside it.
 *
 * Both states are page-level on purpose. The backend answers 403 on EVERY
 * endpoint for a caller in no authorised group, so rendering a per-panel error
 * would show the same refusal three times; and with no backend URL there is
 * nothing to request at all, so the filters and table would be furniture around
 * an empty room.
 */
export default function SalesShell({
  title,
  subtitle,
  configured,
  configKey,
  forbidden,
  children,
}: {
  title: string;
  subtitle?: string;
  configured: boolean;
  configKey: string;
  /** True when the backend has refused this caller outright (403). */
  forbidden?: boolean;
  children: ReactNode;
}) {
  const active = useActivePerspective();
  // No access: exactly the screen Security and Compliance and Marketing Ops show when nothing in
  // them is open to you (PerspectiveLanding's title + card) -- no subtitle, since it describes
  // content the caller cannot see. The rail hides this perspective's rows the same way
  // (useSalesRailGate).
  if (configured && forbidden) {
    return (
      <Box>
        <PageTitle label={active.label} />
        <NothingHere label={active.label} icon={active.icon} />
      </Box>
    );
  }

  return (
    <Box>
      <PerspectiveHeader title={title} subtitle={subtitle} />

      {!configured ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Sales isn&apos;t connected yet. Set <code>{configKey}</code> in{" "}
          <code>public/config.js</code> (the meet-app backend URL) and reload.
        </Alert>
      ) : (
        children
      )}
    </Box>
  );
}
