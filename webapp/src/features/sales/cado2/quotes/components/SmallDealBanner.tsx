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
import { Alert, AlertTitle } from "@wso2/oxygen-ui";
import type { SmallDeal } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatMoney } from "@features/sales/cado2/utils/money";

/**
 * The small-deal warning (2026-10-24): a deal whose total contract
 * value is under USD 30,000, at Salesforce's current rate, asks the AM to
 * contact their Sales Manager and the BU GM. It doesn't block anything.
 */
export default function SmallDealBanner({
  smallDeal,
  currency,
  tcv,
}: {
  smallDeal: SmallDeal | null | undefined;
  /** The quote's currency and TCV, shown as they are when not in USD. */
  currency: string;
  tcv: string | null | undefined;
}): JSX.Element | null {
  if (!smallDeal) return null;
  const value =
    currency === "USD" || !tcv
      ? `USD ${formatMoney(smallDeal.tcvUsd)}`
      : `${currency} ${formatMoney(tcv)} (about USD ${formatMoney(smallDeal.tcvUsd)})`;
  return (
    <Alert severity="warning" aria-label="Small deal">
      <AlertTitle>Deal under USD {formatMoney(smallDeal.thresholdUsd.replace(/\.00$/, ""))}</AlertTitle>
      The total contract value is {value}. Contact your Sales Manager and the BU GM about this deal.
    </Alert>
  );
}
