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

import { Button, Card, Chip, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { useAsgardeoGroups } from "@hooks/useAsgardeoGroups";
import Reveal from "@components/reveal/Reveal";

// The signed-in user's Asgardeo groups, from the id_token's `groups` claim.
// Hidden behind <Reveal> by default: group names can expose access levels
// and team structure, which a reader may not want on a shared screen.
export default function GroupsCard() {
  const { ready, groups, error, retry } = useAsgardeoGroups();
  const sorted = [...groups].sort((a, b) => a.localeCompare(b));

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Reveal
        label="groups"
        header={
          <Typography
            sx={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "text.secondary",
              fontWeight: 600,
            }}
          >
            My Groups
          </Typography>
        }
      >
        {!ready ? (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {[72, 96, 60].map((w) => (
              <Skeleton key={w} variant="rounded" width={w} height={24} />
            ))}
          </Stack>
        ) : error ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ fontSize: 12.5, color: "error.main", flex: 1 }}>{error}</Typography>
            <Button size="small" onClick={retry}>
              Retry
            </Button>
          </Stack>
        ) : sorted.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", py: 0.5 }}>
            You aren't in any groups.
          </Typography>
        ) : (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {sorted.map((g) => (
              <Chip key={g} label={g} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
      </Reveal>
    </Card>
  );
}
