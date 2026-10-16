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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { Box, Button, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from "@wso2/oxygen-ui";
import { PlusIcon, RotateCw } from "@wso2/oxygen-ui-icons-react";
import { type Query, useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { useUmtGate } from "../api/useUmtGate";
import UmtPendingReleaseChunksGrid from "../components/release-chunks/UmtPendingReleaseChunksGrid";
import UmtReleasedChunksGrid from "../components/release-chunks/UmtReleasedChunksGrid";
import UmtShell from "../components/UmtShell";
import { umtPaths } from "../lib/umtPaths";

type UmtReleaseChunkStatusFilter = "pending" | "released";

function parseStatus(value: string | null): UmtReleaseChunkStatusFilter {
  return value === "released" ? "released" : "pending";
}

// Every query behind this page: the pending and released lists and each
// chunk's lifecycle, build, CST and Docker statuses.
function isReleaseChunkQuery(query: Query): boolean {
  const [key] = query.queryKey;
  return typeof key === "string" && key.startsWith("umt-release");
}

export default function UmtReleaseChunksPage() {
  return (
    <UmtShell title="Release Chunks">
      <UmtReleaseChunksBody />
    </UmtShell>
  );
}

// Pending and released chunks are two views of the same thing, so they share
// one page and one route, with `?status=` selecting between them. Keeping it
// in the URL means the dashboard's View pending / View released buttons can
// link straight to either, and a reloaded or shared link lands where it
// left off.
function UmtReleaseChunksBody() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const gate = useUmtGate();
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ predicate: isReleaseChunkQuery }) > 0;
  const status = parseStatus(searchParams.get("status"));

  const setStatus = (next: UmtReleaseChunkStatusFilter) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("status", next);
      return params;
    });
  };

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1.25 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_event, value: UmtReleaseChunkStatusFilter | null) => value && setStatus(value)}
        >
          <ToggleButton value="pending" sx={{ textTransform: "none" }}>
            Pending
          </ToggleButton>
          <ToggleButton value="released" sx={{ textTransform: "none" }}>
            Released
          </ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <span>
            <IconButton
              aria-label="Refresh"
              disabled={refreshing}
              onClick={() => void queryClient.invalidateQueries({ predicate: isReleaseChunkQuery })}
            >
              <RotateCw size={16} />
            </IconButton>
          </span>
        </Tooltip>
        {gate.isAdmin && (
          <Button
            variant="contained"
            startIcon={<PlusIcon size={16} />}
            onClick={() => navigate(umtPaths.newReleaseChunk)}
          >
            Create
          </Button>
        )}
      </Box>

      {status === "pending" ? <UmtPendingReleaseChunksGrid /> : <UmtReleasedChunksGrid />}
    </Stack>
  );
}
