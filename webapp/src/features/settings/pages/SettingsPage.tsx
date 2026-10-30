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

import { Box, MenuItem, TextField, Typography } from "@wso2/oxygen-ui";
import { useState, type JSX } from "react";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import {
  landingOptions,
  landingPreference,
  setLandingPreference,
} from "@config/landingConfig";
import { availableSettingsSections } from "../settingsSections";

/** Where everyone opens until they choose otherwise. */
const DEFAULT_KEY = "me";

export default function SettingsPage(): JSX.Element {
  const options = landingOptions();
  // No "follow the deployment" state to represent any more, so the select shows
  // the perspective that will actually be opened — Me until they pick another.
  const [choice, setChoice] = useState<string>(() => landingPreference() ?? DEFAULT_KEY);

  const handleChange = (next: string) => {
    setChoice(next);
    setLandingPreference(next);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PerspectiveHeader
        title="Settings"
        subtitle="Preferences that apply to you, on this browser."
      />

      <Box sx={{ maxWidth: 420 }}>
        <TextField
          select
          fullWidth
          size="small"
          label="Open on"
          value={choice}
          onChange={(e) => handleChange(e.target.value)}
          helperText="Saved on this browser."
        >
          {options.map((o) => (
            <MenuItem key={o.key} value={o.key}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Takes effect the next time you open One WSO2 without a specific page in
          the address bar.
        </Typography>
      </Box>

      {availableSettingsSections().map((s) => (
        <Box key={s.id} component="section" id={s.id} aria-labelledby={`${s.id}-title`}>
          <Typography id={`${s.id}-title`} component="h2" variant="h6" sx={{ mb: 1.5 }}>
            {s.title}
          </Typography>
          {s.render()}
        </Box>
      ))}
    </Box>
  );
}
