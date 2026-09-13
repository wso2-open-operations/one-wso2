/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState } from "react";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls } from "@config/apiConfig";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import type { ExpenseTransaction } from "../expenseTypes";

/**
 * Every receipt on a claim, fetched once so the printed report can embed them.
 *
 * The source loads receipts for every viewer, because each claim-item card
 * fetches its own on mount (`ClaimItemCard.tsx:46-70`). This fetches them only
 * for the stage that can print, so a lead reading a queue does not pull a
 * megabyte of images they are never shown; opening a single receipt still goes
 * through the viewer's own fetch.
 *
 * A failed receipt resolves to `null` rather than rejecting the batch — the
 * source does the same, and the report simply omits that image. That matters
 * today: the backend 500s on any receipt whose file name carries a dot in the
 * employee's name, because it reads the extension from the FIRST dot
 * (`service.bal:570`). The old app fails on those too.
 */
export function useClaimReceipts(transactions: ExpenseTransaction[], enabled: boolean) {
  const getAccessToken = useAccessToken();
  const [sources, setSources] = useState<(ReceiptSource | null)[] | null>(null);

  // Keyed on the file names so a different claim refetches, and a re-render
  // with the same claim does not.
  const names = transactions.map((t) => t.receiptUrl ?? "").join("|");

  useEffect(() => {
    if (!enabled) {
      setSources(null);
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    setSources(null);

    void (async () => {
      const accessToken = await getAccessToken();
      const loaded = await Promise.all(
        transactions.map(async (t) => {
          if (!t.receiptUrl) return null;
          try {
            const src = await fetchReceiptObjectUrl(
              expenseServiceUrls.receiptFile(t.receiptUrl),
              accessToken,
            );
            created.push(src.url);
            return src;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) {
        created.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setSources(loaded);
    })();

    return () => {
      cancelled = true;
      // These URLs are created here, so they are revoked here — the ownership
      // rule `ReceiptViewer` follows for the ones it creates itself.
      created.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, enabled]);

  return { sources, loading: enabled && sources === null };
}
