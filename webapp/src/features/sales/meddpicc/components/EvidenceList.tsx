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

import { Stack, Typography } from "@wso2/oxygen-ui";
import type { EvidenceQuote, EvidenceSourceType } from "../types";
import { newestFirst, sourceOf } from "../util/evidenceSource";
import EvidenceItem from "./EvidenceItem";

/**
 * The quotes behind a Proposal, newest first, each with who said it and where.
 *
 * Verbatim and attributed: the AM is being asked to put this in Salesforce under their
 * name, so what they check it against is what the customer said, not a summary of it.
 * Newest first because a later conversation can overtake an earlier one.
 */
export default function EvidenceList({
  evidence,
  sourceFilter = null,
}: {
  evidence: EvidenceQuote[];
  /** Show one source only; null shows all. */
  sourceFilter?: EvidenceSourceType | null;
}) {
  if (evidence.length === 0) return null;
  const shown = newestFirst(evidence).filter((q) => !sourceFilter || sourceOf(q).type === sourceFilter);
  if (shown.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No evidence from this source.
      </Typography>
    );
  }
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0 }} aria-label="Evidence">
      {shown.map((q, i) => (
        <li key={`${sourceOf(q).type}-${sourceOf(q).id}-${q.offsetSeconds}-${i}`}>
          <EvidenceItem quote={q} />
        </li>
      ))}
    </Stack>
  );
}
