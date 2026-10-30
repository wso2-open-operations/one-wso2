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
import type { DashboardScorecard } from "../../api/amplifyTypes";
import { useDashboardScorecard } from "../../api/useAmplifyDashboards";
import AmplifyShell from "../../components/AmplifyShell";
import { Block, BoardState, Empty, StateChip } from "../../components/DashboardParts";
import type { ScorecardMeasure } from "../../api/amplifyTypes";
import { updatedStamp, fraction, measureValue, scoreBar, targetText } from "../../util/dashboardFormat";

/**
 * A measure's value against its target: blue when on track, orange on watch (the status chip says it in
 * words too, so colour is never the only signal). The line marks the target, or the ceiling for AT_MOST,
 * on the same scale as the fill, with its value written under it.
 */
export function MeasureBar({ measure }: { measure: ScorecardMeasure }) {
  const bar = scoreBar(measure);
  const color = measure.status === "ON_TRACK" ? "#60A5FA" : "#FF7300";
  // Keep the label inside the card when the mark is near an end.
  const align = bar.tick < 0.12 ? "left" : bar.tick > 0.88 ? "right" : "center";
  const shift = align === "left" ? "0" : align === "right" ? "-100%" : "-50%";
  return (
    <Box sx={{ minWidth: 0, pb: 2.5 }}>
      <Box
        role="progressbar"
        aria-label={measure.label}
        aria-valuemin={0}
        aria-valuemax={bar.max}
        aria-valuenow={bar.now}
        aria-valuetext={bar.text}
        sx={{ position: "relative", height: 12, borderRadius: 6, bgcolor: "action.hover" }}
      >
        <Box sx={{ width: `${bar.fill * 100}%`, height: "100%", borderRadius: 6, bgcolor: color }} />
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: -4,
            bottom: -4,
            left: `calc(${bar.tick * 100}% - 1px)`,
            width: 2,
            bgcolor: "text.primary",
            borderRadius: 1,
          }}
        />
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 18,
            left: `${bar.tick * 100}%`,
            transform: `translateX(${shift})`,
            fontSize: 11,
            whiteSpace: "nowrap",
            color: "text.secondary",
          }}
        >
          {bar.tickLabel}
        </Box>
      </Box>
    </Box>
  );
}

/** Each measure against its target. Status comes from the API; nothing is recomputed here. */
export function ScorecardBoard({ data }: { data: DashboardScorecard }) {
  const onTrack = data.measures.filter((m) => m.status === "ON_TRACK").length;
  const watch = data.measures.length - onTrack;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {updatedStamp(data.asOf)}
      </Typography>
      <Block
        title="Participation measures"
        action={
          data.measures.length > 0 && (
            <Box sx={{ display: "flex", gap: 1 }}>
              <StateChip label={`${onTrack} on track`} tone="info" />
              {watch > 0 && <StateChip label={`${watch} watch`} tone="warning" />}
            </Box>
          )
        }
      >
        {data.measures.length === 0 ? (
          <Empty>No measures yet.</Empty>
        ) : (
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {data.measures.map((m) => {
              const detail = fraction(m);
              const onTrack = m.status === "ON_TRACK";
              return (
                <Box
                  component="li"
                  key={m.key}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 1fr) minmax(200px, 2fr) auto" },
                    alignItems: "center",
                    columnGap: 3,
                    rowGap: 1,
                    py: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box>{m.label}</Box>
                    <Box sx={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>
                      {measureValue(m)}
                      {detail && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                          {detail}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" component="div">
                      {targetText(m)}
                      {m.note ? ` · ${m.note}` : ""}
                    </Typography>
                  </Box>
                  <MeasureBar measure={m} />
                  <Box sx={{ justifySelf: { xs: "start", md: "end" } }}>
                    <StateChip label={onTrack ? "On track" : "Watch"} tone={onTrack ? "info" : "warning"} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        {data.measures.length > 0 && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
            Bar = current value. Line = target (or ceiling for expired).
          </Typography>
        )}
      </Block>
    </Box>
  );
}

export default function ScorecardPage() {
  const q = useDashboardScorecard();
  return (
    <AmplifyShell title="Scorecard" subtitle="How participation is tracking against its targets.">
      <BoardState queries={[q]}>{q.data && <ScorecardBoard data={q.data} />}</BoardState>
    </AmplifyShell>
  );
}
