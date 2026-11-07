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

import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import { useEffect, type JSX } from "react";
import type { LookupOption } from "../../api/riskApi";
import PillMultiSelect from "./PillMultiSelect";
import type { PlatformChoices } from "./templates";

interface PlatformPickerProps {
  choices: PlatformChoices;
  // Platform and sub-platform ids together: both are risk_platform rows.
  value: number[];
  onChange: (value: number[]) => void;
  error?: string;
}

const optionLabel = (o: LookupOption): string => (o.status === "ACTIVE" ? o.name : `${o.name} (inactive)`);

// Platform, then the sub-platforms of each platform picked. A sub-platform only
// exists under its platform, so unticking a platform drops its sub-platforms
// from the value: the server refuses a sub-platform without its platform.
// A register that offers a single platform has nothing to choose at that level:
// it is picked for the risk and only its sub-platforms are shown.
export default function PlatformPicker({ choices, value, onChange, error }: PlatformPickerProps): JSX.Element {
  const subIdsOf = (parentId: number): number[] => (choices.subsByParent.get(parentId) ?? []).map((s) => s.id);

  const handlePlatforms = (next: number[]): void => {
    const dropped = choices.platforms.map((p) => p.id).filter((id) => !next.includes(id));
    const orphaned = dropped.flatMap(subIdsOf);
    onChange([...next, ...value.filter((id) => !choices.platforms.some((p) => p.id === id) && !orphaned.includes(id))]);
  };

  const handleSubs = (parentId: number, next: number[]): void => {
    onChange([...value.filter((id) => !subIdsOf(parentId).includes(id)), ...next]);
  };

  const platformValue = value.filter((id) => choices.platforms.some((p) => p.id === id));
  const soleId = choices.restricted && choices.platforms.length === 1 ? choices.platforms[0].id : null;
  const soleMissing = soleId !== null && !value.includes(soleId);

  useEffect(() => {
    if (soleId !== null && soleMissing) onChange([...value, soleId]);
  }, [soleId, soleMissing, value, onChange]);

  return (
    <Stack gap={2.5}>
      {soleId === null && (
        <PillMultiSelect
          label="Platform"
          required
          ariaLabel="Platforms"
          options={choices.platforms.map((p) => ({ value: p.id, label: optionLabel(p) }))}
          value={platformValue}
          onChange={handlePlatforms}
          error={error}
          emptyMessage="No platforms have been added yet. Ask a platform admin to add them."
        />
      )}
      {choices.platforms
        .filter((p) => platformValue.includes(p.id) && (choices.subsByParent.get(p.id)?.length ?? 0) > 0)
        .map((p) => (
          <Box key={p.id} sx={soleId === null ? { pl: 2, borderLeft: 2, borderColor: "divider" } : undefined}>
            <PillMultiSelect
              label={`${p.name} sub-platform`}
              required={choices.restricted}
              ariaLabel={`${p.name} sub-platforms`}
              options={(choices.subsByParent.get(p.id) ?? []).map((s) => ({ value: s.id, label: optionLabel(s) }))}
              value={value.filter((id) => subIdsOf(p.id).includes(id))}
              onChange={(next) => handleSubs(p.id, next)}
              error={soleId === p.id ? error : undefined}
            />
            {!choices.restricted && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Optional: leave empty if the risk affects the platform as a whole.
              </Typography>
            )}
          </Box>
        ))}
    </Stack>
  );
}
