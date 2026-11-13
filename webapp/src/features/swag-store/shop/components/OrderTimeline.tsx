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

import type { JSX } from "react";
import { Box, Typography } from "@wso2/oxygen-ui";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import type { SwagStoreOrderDetail } from "../../api/swagStoreTypes";
import { formatInstant } from "../../util/civilDate";

/**
 * Placed and paid → Ready for pickup → Collected. Each step says in words
 * whether it has happened and when, so the ticks are never the only cue.
 */
export default function OrderTimeline({ order }: { order: SwagStoreOrderDetail }): JSX.Element {
  const steps = [
    { label: "Placed and paid", at: order.confirmedAt },
    { label: "Ready for pickup", at: order.readyAt },
    { label: "Collected", at: order.collectedAt },
  ];
  return (
    <Box component="ol" aria-label="Order progress" sx={{ m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
      {steps.map((step) => (
        <Box component="li" key={step.label} sx={{ listStyle: "none", display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              border: 2,
              borderColor: step.at ? "success.main" : "divider",
              color: "success.main",
            }}
          >
            {step.at && <CheckIcon size={14} />}
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {step.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {step.at ? formatInstant(step.at) : "Not yet"}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
