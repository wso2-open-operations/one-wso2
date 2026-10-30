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

import { useState } from "react";
import { Alert, Box, Button, Chip, Skeleton, Typography } from "@wso2/oxygen-ui";
import { LinkIcon, LinkedinIcon } from "@wso2/oxygen-ui-icons-react";
import { useAmplifyMe } from "../api/useAmplifyData";
import type { LinkedInStatus } from "../api/amplifyTypes";
import LinkLinkedInDialog from "./LinkLinkedInDialog";
import RemoveLinkedInDialog from "./RemoveLinkedInDialog";

const SETTINGS_PATH = "/settings";

const STATUS_LABEL: Record<LinkedInStatus, { label: string; color: "success" | "warning" | "default" }> = {
  ACTIVE: { label: "Connected", color: "success" },
  EXPIRING: { label: "Expires soon", color: "warning" },
  NEEDS_RECONNECT: { label: "Needs reconnect", color: "warning" },
  REMOVED: { label: "Not connected", color: "default" },
  NOT_CONNECTED: { label: "Not connected", color: "default" },
};

const dateOnly = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : null);

/**
 * Settings > My Connections: the employee's LinkedIn link for Amplify. Link me opens the consent pop-up
 * (returning here after LinkedIn), Remove connection confirms and deletes the link.
 */
export default function MyConnectionsSection() {
  const me = useAmplifyMe();
  const [linking, setLinking] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (me.isPending) return <Skeleton variant="rounded" height={72} sx={{ maxWidth: 520 }} />;
  if (me.isError) return <Alert severity="warning">Couldn&apos;t load your LinkedIn connection.</Alert>;

  const status = me.data.linkedin.status;
  const connected = status === "ACTIVE" || status === "EXPIRING";
  const reconnect = status === "NEEDS_RECONNECT";
  const chip = STATUS_LABEL[status] ?? STATUS_LABEL.NOT_CONNECTED;
  const expires = dateOnly(me.data.linkedin.expiresAt);

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 2,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Box sx={{ color: "primary.main", display: "flex" }}>
          <LinkedinIcon size={24} aria-hidden />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>LinkedIn</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Chip size="small" label={chip.label} color={chip.color} />
            {connected && expires && (
              <Typography variant="caption" color="text.secondary">
                Link renews by {expires}
              </Typography>
            )}
          </Box>
        </Box>
        {connected ? (
          <Button color="error" onClick={() => setRemoving(true)}>
            Remove connection
          </Button>
        ) : (
          <Button variant="contained" startIcon={<LinkIcon size={16} />} onClick={() => setLinking(true)}>
            {reconnect ? "Link again" : "Link me"}
          </Button>
        )}
      </Box>
      {reconnect && (
        <Button size="small" color="error" sx={{ mt: 1 }} onClick={() => setRemoving(true)}>
          Remove connection
        </Button>
      )}

      <LinkLinkedInDialog
        open={linking}
        onClose={() => setLinking(false)}
        returnTo={SETTINGS_PATH}
        reconnect={reconnect}
      />
      <RemoveLinkedInDialog open={removing} onClose={() => setRemoving(false)} />
    </Box>
  );
}
