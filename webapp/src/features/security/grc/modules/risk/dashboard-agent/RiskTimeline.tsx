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

import { Box, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { Timeline } from "./dashboardAgentApi";

// RiskTimeline draws a risk's history as a vertical line of dated events.
export default function RiskTimeline({ timeline }: { timeline: Timeline }): JSX.Element {
  return (
    <Box sx={{ mt: 1.5 }} aria-label="History timeline">
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        What happened
      </Typography>
      {timeline.note && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          {timeline.note}
        </Typography>
      )}
      <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, borderLeft: 2, borderColor: "divider", ml: 0.75 }}>
        {timeline.events.map((e, i) => (
          <Box component="li" key={i} sx={{ position: "relative", pl: 2, pb: 1.25 }}>
            <Box
              sx={{
                position: "absolute",
                left: -5,
                top: 6,
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "primary.main",
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {e.date}
            </Typography>
            <Typography variant="body2">{e.text}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
