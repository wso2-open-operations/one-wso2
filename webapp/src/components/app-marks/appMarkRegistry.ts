/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import type { ReactElement } from "react";
import { AmplifyLogo } from "@features/amplify/components/AmplifyLogo";
import {
  CustomerSuccessMark,
  EngineeringMark,
  FinanceMark,
  KnowledgeMark,
  LegalMark,
  SecurityMark,
  MarketingMark,
  MeMark,
  PeopleMark,
  ProcurementMark,
  SalesMark,
  InfrastructureMark,
  type MarkProps,
} from "./AppMark";

/**
 * Keyed by `PerspectiveDef.key`. Undefined for a perspective without a mark —
 * the launcher then falls back to its line glyph on the wash.
 */
const APP_MARKS: Record<string, (p: MarkProps) => ReactElement> = {
  me: MeMark,
  people: PeopleMark,
  finance: FinanceMark,
  marketing: MarketingMark,
  legal: LegalMark,
  security: SecurityMark,
  sales: SalesMark,
  engineering: EngineeringMark,
  infra: InfrastructureMark,
  knowledge: KnowledgeMark,
  procurement: ProcurementMark,
  "customer-success": CustomerSuccessMark,
};

/**
 * Perspectives whose tile shows the product's own logo instead of a drawn
 * two-tone mark. A logo brings its own colours, so these have no entry in
 * APP_MARK_TONES and the tone tests skip them.
 */
const BRAND_MARKS: Record<string, (p: MarkProps) => ReactElement> = {
  amplify: AmplifyLogo,
};

/** The keys in BRAND_MARKS, for the tests that hold drawn marks to their tones. */
export const BRAND_MARK_KEYS: ReadonlySet<string> = new Set(Object.keys(BRAND_MARKS));

/**
 * The mark for a perspective, or undefined when none is registered — the caller
 * is expected to fall back to that perspective's line glyph.
 */
export function appMark(key: string): ((p: MarkProps) => ReactElement) | undefined {
  if (Object.prototype.hasOwnProperty.call(APP_MARKS, key)) return APP_MARKS[key];
  return Object.prototype.hasOwnProperty.call(BRAND_MARKS, key) ? BRAND_MARKS[key] : undefined;
}
