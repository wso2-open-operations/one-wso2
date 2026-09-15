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

import type { ComponentType } from "react";
import { Box, Card, Typography } from "@wso2/oxygen-ui";

/**
 * Shared placeholder for an Operations domain — the rail/nav shape is ported
 * 1:1 from cs-tools/apps/csm-portal (see csmNavItems.ts's "operations"
 * section), but none of the five domains (Service requests, Change requests,
 * Incidents, Problem management, Outages) has a real backend/page ported yet.
 * One shared component rather than five near-identical files.
 *
 * The header is the fixed "Operations" title/subtitle, not a per-domain one —
 * ported 1:1 from cs-tools/apps/csm-portal's own OperationsPage, which shows
 * that exact same header no matter which of its five tabs is active; only the
 * content below it changes. `domainLabel` names which domain this instance is
 * for in that content, the same role a tab's own body plays in the source app.
 */
export default function CsmOperationsPlaceholderPage({
  domainLabel,
  icon: Icon,
}: {
  domainLabel: string;
  icon: ComponentType<{ size?: number | string }>;
}) {
  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mb: 0.5, mt: 0 }}>
        Operations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
        Service requests, change requests, incidents, and problems across customers.
      </Typography>
      <Card
        variant="outlined"
        sx={{
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 1.5,
        }}
      >
        <Box sx={{ color: "text.secondary" }}>
          <Icon size={28} />
        </Box>
        <Typography sx={{ fontWeight: 600 }}>Coming soon</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "48ch" }}>
          {domainLabel} isn't wired up yet — this page is a placeholder so the
          Operations rail entry ported from CSM Portal has somewhere to land.
        </Typography>
      </Card>
    </Box>
  );
}
