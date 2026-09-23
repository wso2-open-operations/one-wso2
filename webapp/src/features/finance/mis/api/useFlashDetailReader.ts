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

import { useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isMisFlashConfigured } from "@config/apiConfig";
import {
  flashAccountSummaryQuery,
  flashDetailBody,
  flashSalesQuery,
  type FlashDetailAnswer,
  type FlashDetailRequest,
} from "./flashDetailQueries";

// Every business unit's monthly detail, read on demand — the Full Report's
// half of the Flash export (ticket 18).
//
// Ported from `FlashConsole.js`'s `fetchMonthlySummary`, which the source runs
// when its Export menu's "Full Report" is clicked: the same two reads a monthly
// view makes, for all six units. A function rather than a query, because
// nothing asks until that click, and what it returns goes straight into a
// workbook rather than onto a screen.
//
// Through the query cache rather than around it (`fetchQuery`, under the keys
// `flashDetailQueries` shares with `useFlashDetail`), so a unit its dialog
// already read under the SAME body is not asked for again, and a dialog opened
// afterwards under it is already filled. That is every unit while no
// sub-region is applied, and Integration alone while one is: the other five
// dialogs send none (spec §8), where the Full Report sends the reader's.

/**
 * Three units at a time: the source's `CONCURRENCY_LIMIT`, kept. Each unit is
 * two reads of a year of P&L, from a backend last deployed from a 407-day-old
 * commit, and twelve at once is the load it was never asked to take.
 */
const BUSINESS_UNITS_AT_ONCE = 3;

/** Reads each request's two answers, in the order asked. Rejects if any read fails. */
type ReadFlashDetails = (
  requests: readonly FlashDetailRequest[],
) => Promise<FlashDetailAnswer[]>;

export function useFlashDetailReader(): ReadFlashDetails {
  const client = useQueryClient();
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const readOne = async (request: FlashDetailRequest): Promise<FlashDetailAnswer> => {
    const body = flashDetailBody(request);
    const [sales, accounts] = await Promise.all([
      client.fetchQuery(flashSalesQuery(userSub, body, getAccessToken)),
      client.fetchQuery(flashAccountSummaryQuery(userSub, body, getAccessToken)),
    ]);
    return { sales, accounts };
  };

  return async (requests) => {
    // Unreachable from the screen, whose P&L needed all three to load — but a
    // read made without an identity would be cached under an `undefined` user.
    if (!isSignedIn || !isMisFlashConfigured() || !userSub) {
      throw new Error("The Flash backend isn't ready to be read yet.");
    }
    const answers: FlashDetailAnswer[] = [];
    // In batches, and collected by POSITION. The source stores each answer as
    // it resolves, so its sheets come out in whichever order the reads landed —
    // which can be a different workbook each time for the same figures.
    for (let start = 0; start < requests.length; start += BUSINESS_UNITS_AT_ONCE) {
      answers.push(
        ...(await Promise.all(requests.slice(start, start + BUSINESS_UNITS_AT_ONCE).map(readOne))),
      );
    }
    return answers;
  };
}
