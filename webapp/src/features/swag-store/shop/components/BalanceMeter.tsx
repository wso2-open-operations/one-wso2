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
import { Box } from "@wso2/oxygen-ui";
import { formatBalance, formatCoins } from "../../util/coins";

/**
 * How much of the wallet the total uses, as a bar. Its name says the same in
 * words ("180 O2C of 202.50 O2C used"), so the bar is never the only cue.
 */
export default function BalanceMeter({ total, balance }: { total: number; balance: string }): JSX.Element {
  const have = Number(balance);
  const share = Number.isFinite(have) && have > 0 ? Math.min(1, total / have) : 1;
  const enough = Number.isFinite(have) && have >= total;
  return (
    <Box
      role="img"
      aria-label={`${formatCoins(total)} of ${formatBalance(balance)} used`}
      sx={{ height: 8, borderRadius: 4, bgcolor: "action.hover", overflow: "hidden" }}
    >
      <Box
        sx={{
          height: "100%",
          width: `${Math.round(share * 100)}%`,
          bgcolor: enough ? "success.main" : "error.main",
          transition: "width 200ms",
        }}
      />
    </Box>
  );
}
