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

import { useState, type JSX } from "react";
import { Box, Button, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Typography } from "@wso2/oxygen-ui";
import type { SwagStoreOffice } from "../../api/swagStoreTypes";

interface OfficePickerProps {
  readonly offices: readonly SwagStoreOffice[];
  readonly chosenId: string | undefined;
  readonly onChoose: (officeId: string) => void;
}

const days = (n: number) => `${n} working ${n === 1 ? "day" : "days"}`;

/**
 * "Pickup office": one card per office with its lead time, collection point
 * and hours. With an office chosen, only that one shows until the shopper asks for the rest.
 */
export default function OfficePicker({ offices, chosenId, onChoose }: OfficePickerProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const chosen = offices.find((o) => o.id === chosenId);
  const shown = showAll || !chosen ? offices : [chosen];
  return (
    <FormControl component="fieldset" sx={{ width: "100%" }}>
      <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600, color: "text.primary" }}>
        Pickup office
      </FormLabel>
      <RadioGroup value={chosen?.id ?? ""} onChange={(e) => onChoose(e.target.value)} sx={{ gap: 1 }}>
        {shown.map((o) => (
          <FormControlLabel
            key={o.id}
            value={o.id}
            control={<Radio size="small" />}
            sx={{
              m: 0,
              p: 1.5,
              alignItems: "flex-start",
              border: 1,
              borderColor: o.id === chosen?.id ? "primary.main" : "divider",
              borderRadius: 1.5,
              ".MuiRadio-root": { pt: 0.25 },
            }}
            label={
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                <Typography component="span" sx={{ fontWeight: 600 }}>
                  {o.name}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                  {o.address}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                  Collect from {o.collectionPoint} · {o.hours}
                </Typography>
                <Typography component="span" variant="body2">
                  Ready about {days(o.leadTimeDays)} after you pay
                </Typography>
              </Box>
            }
          />
        ))}
      </RadioGroup>
      {!showAll && chosen && offices.length > 1 && (
        <Box>
          <Button size="small" onClick={() => setShowAll(true)} sx={{ mt: 1 }}>
            Show all {offices.length} offices
          </Button>
        </Box>
      )}
    </FormControl>
  );
}
