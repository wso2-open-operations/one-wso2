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

import { Chip, type SxProps, type Theme } from "@wso2/oxygen-ui";

/**
 * An Opportunity Stage, as a small chip.
 *
 * Neutral for every open stage — a colour per stage would read as a verdict
 * on the deal, and nobody made one. Closed Won and Closed Lost are the only
 * stages that do say something, so they are the only ones coloured.
 */
export default function StageChip({
  stage,
  title,
  sx,
}: {
  stage: string;
  title?: string;
  /** Extra styles, merged over the chip's own -- a fixed width in a table, say. */
  sx?: SxProps<Theme>;
}) {
  const color = stage === "Closed Won" ? "success" : stage === "Closed Lost" ? "default" : "primary";
  return (
    <Chip
      label={stage}
      title={title}
      size="small"
      color={color}
      variant="outlined"
      sx={[{ height: 20, fontSize: "0.7rem", fontWeight: 600 }, ...(Array.isArray(sx) ? sx : [sx])]}
    />
  );
}
