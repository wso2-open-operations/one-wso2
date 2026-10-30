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

import { alpha, Box, Typography } from "@wso2/oxygen-ui";

/** One rule tile: a big figure on the left, the rule in words on the right. */
function RuleTile({ figure, lead, text, tone }: { figure: string; lead: string; text: string; tone: "primary" | "info" }) {
  return (
    <Box
      component="li"
      sx={(theme) => ({
        listStyle: "none",
        flex: "1 1 280px",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(theme.palette[tone].main, 0.35),
        bgcolor: alpha(theme.palette[tone].main, 0.1),
      })}
    >
      <Typography
        component="span"
        aria-hidden
        sx={{ fontSize: { xs: 32, sm: 40 }, fontWeight: 800, lineHeight: 1, color: `${tone}.main`, whiteSpace: "nowrap" }}
      >
        {figure}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
        <Box component="strong" sx={{ color: "text.primary", fontWeight: 700 }}>
          {lead}
        </Box>{" "}
        {text}
      </Typography>
    </Box>
  );
}

/** Explains the monthly podium: the points needed to qualify, and who gets recognized. */
export default function HowWinnersAreChosen({ minPoints, topN }: { minPoints: number; topN: number }) {
  return (
    <Box component="section" aria-label="How monthly winners are chosen" sx={{ mt: 3 }}>
      <Typography
        component="h3"
        variant="overline"
        sx={{ display: "block", fontWeight: 700, letterSpacing: "0.08em", color: "text.secondary", lineHeight: 1.5, mb: 1 }}
      >
        How monthly winners are chosen
      </Typography>
      <Box component="ul" sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, p: 0, m: 0 }}>
        <RuleTile
          figure={minPoints.toLocaleString()}
          lead="Minimum to qualify."
          text={`Earn at least ${minPoints.toLocaleString()} points in the month.`}
          tone="primary"
        />
        <RuleTile
          figure={`Top ${topN}`}
          lead="Recognized every month."
          text={`The top ${topN} advocates are celebrated.`}
          tone="info"
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        <Box component="strong" sx={{ color: "text.primary", fontWeight: 700 }}>
          Please note:
        </Box>{" "}
        if more than {topN === 3 ? "three" : topN} advocates qualify for the top spots, a further evaluation will be conducted
        based on post reach.
      </Typography>
    </Box>
  );
}
