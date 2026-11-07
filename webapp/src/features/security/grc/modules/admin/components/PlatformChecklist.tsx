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

import { Box, Checkbox, FormControlLabel, FormGroup, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { Lookup } from "../api/adminApi";

interface PlatformChecklistProps {
  // Every platform and sub-platform, inactive ones included.
  platforms: Lookup[];
  // Ids ticked for the register: platforms and sub-platforms together.
  value: number[];
  onChange: (value: number[]) => void;
}

// Which platforms an Aggregated register offers on Add Risk. Ticking a platform
// reveals its sub-platforms, which are ticked the same way. Unticking a platform
// unticks its sub-platforms, because a sub-platform can't be listed without its
// platform (the server refuses it). An inactive value is offered only while it
// is already ticked, so it can be unticked but never newly added.
export default function PlatformChecklist({ platforms, value, onChange }: PlatformChecklistProps): JSX.Element {
  const selectable = (p: Lookup): boolean => p.status === "ACTIVE" || value.includes(p.id);
  const topLevel = platforms.filter((p) => p.parent_id === undefined && selectable(p));
  const subsOf = (id: number): Lookup[] => platforms.filter((p) => p.parent_id === id && selectable(p));
  const label = (p: Lookup): string => (p.status === "ACTIVE" ? p.name : `${p.name} (inactive)`);

  const togglePlatform = (p: Lookup, checked: boolean): void => {
    if (checked) {
      onChange([...value, p.id]);
      return;
    }
    const subIds = platforms.filter((s) => s.parent_id === p.id).map((s) => s.id);
    onChange(value.filter((id) => id !== p.id && !subIds.includes(id)));
  };

  const toggleSub = (s: Lookup, checked: boolean): void =>
    onChange(checked ? [...value, s.id] : value.filter((id) => id !== s.id));

  if (topLevel.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No platforms have been added yet. Add them under the Platforms tab first.
      </Typography>
    );
  }

  return (
    <FormGroup>
      {topLevel.map((p) => {
        const checked = value.includes(p.id);
        const subs = subsOf(p.id);
        return (
          <Box key={p.id}>
            <FormControlLabel
              label={label(p)}
              control={<Checkbox size="small" checked={checked} onChange={(_, c) => togglePlatform(p, c)} />}
            />
            {checked && subs.length > 0 && (
              <Box sx={{ pl: 4 }}>
                {subs.map((s) => (
                  <FormControlLabel
                    key={s.id}
                    label={label(s)}
                    control={
                      <Checkbox size="small" checked={value.includes(s.id)} onChange={(_, c) => toggleSub(s, c)} />
                    }
                  />
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </FormGroup>
  );
}
