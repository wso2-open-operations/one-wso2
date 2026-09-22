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

import { addMonths, type MisMonth } from "./misFlashPeriods";

// Which month's Forecasts an Account View offers to edit.
//
// ---- this is not the cutoff, and it is not Pacific ------------------------
//
// Two rules decide whether a forecast can be written, and the port applies
// exactly one of them.
//
//   1. **The cutoff** — no edits after the 15th — is the SERVER'S, and only
//      the server applies it. `isCutoffDatePassed` in the finance entity
//      service refuses any write once the UTC day is past `DATE_CUTOFF`, and
//      spec §8.1 forbids guessing at it here: a local copy would disagree with
//      the server the moment its constant changed.
//   2. **Which month** is the SOURCE'S, and the port keeps it.
//      `AccountViewTable.js:53` hides the Edit column on every account view
//      but the one for the month before this one. The server never checks the
//      month — its UPDATE is `WHERE id = ?` — so without this rule the port
//      would let Finance write a forecast into any month on the 1st to the
//      15th, which the source has never let anyone do, and both apps' account
//      views would then show it.
//
// Keeping (2) does not pre-empt (1): after the 15th Edit is still offered on
// the right month, and the server refuses it.
//
// **It is the server's month, in UTC**, which makes it the one MIS month not
// computed in Pacific (spec §3). The month before this one is exactly the
// month the P&L fills forecasts into —
// `DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 1 MONTH, '%Y-%m')` in the entity
// service's group searches — and the server's clock is the only one that
// decides whether a write lands. A Pacific rule would, for the first seven or
// eight hours of every month, offer the month before the server's while the
// server's day is the 1st and it accepts anything.
//
// The source's own rule is the viewer's LOCAL month, which in Colombo turns
// five and a half hours before the server's — harmless there, since the
// server's day is then the last of the month and it refuses everything. And it
// compares the year too, so in January, whose month before is last December,
// it offers nothing. That is not reproduced: the server takes December's
// forecasts on 1–15 January like any other month's.

/** The month whose forecasts the server will take, as of `instant`. */
export function flashForecastMonth(instant: Date = new Date()): MisMonth {
  const now: MisMonth = { year: instant.getUTCFullYear(), month: instant.getUTCMonth() + 1 };
  return addMonths(now, -1);
}
