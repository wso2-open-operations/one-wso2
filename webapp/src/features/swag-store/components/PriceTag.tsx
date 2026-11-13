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
import { Typography, type TypographyProps } from "@wso2/oxygen-ui";
import { formatCoins } from "../util/coins";

interface PriceTagProps {
  /** Whole O2C. */
  readonly amount: number;
  /** Say "From" because some options cost more. */
  readonly from?: boolean;
  readonly variant?: TypographyProps["variant"];
}

/** A price in O2C, such as "90 O2C" or "From 90 O2C". */
export default function PriceTag({ amount, from = false, variant = "subtitle1" }: PriceTagProps): JSX.Element {
  return (
    <Typography component="span" variant={variant} sx={{ fontWeight: 600 }}>
      {from ? "From " : ""}
      {formatCoins(amount)}
    </Typography>
  );
}
