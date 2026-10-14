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

import type { TimelineKind } from "../types";

/**
 * How each kind of activity is drawn: colour, size and shape together, so no one of them
 * carries identity alone. The three hues are the first three categorical slots, which
 * validate against each other in both modes (all pairs, as marks on one track can sit
 * side by side); a Salesforce activity, the weakest evidence, is a neutral ring rather
 * than a fourth hue. Size follows weight: a customer call is the biggest thing on the track.
 */
export const KINDS: Record<
  TimelineKind,
  { label: string; plural: string; size: number; shape: "circle" | "diamond" | "ring"; light?: string; dark?: string }
> = {
  CUSTOMER_CALL: { label: "Customer call", plural: "customer calls", size: 12, shape: "circle", light: "#2a78d6", dark: "#3987e5" },
  EMAIL: { label: "Email", plural: "emails", size: 10, shape: "diamond", light: "#1baf7a", dark: "#199e70" },
  INTERNAL_CALL: { label: "Internal discussion", plural: "internal discussions", size: 8, shape: "circle", light: "#eb6834", dark: "#d95926" },
  ACTIVITY: { label: "Salesforce activity", plural: "activities", size: 7, shape: "ring" },
};
export const KIND_ORDER: TimelineKind[] = ["CUSTOMER_CALL", "INTERNAL_CALL", "EMAIL", "ACTIVITY"];
