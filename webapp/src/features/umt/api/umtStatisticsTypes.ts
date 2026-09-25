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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// The legacy Statistics view selects one of these endpoint shapes. They are
// backend filter modes, not UI labels; the page owns the labels later.
export type UmtPlatformStatsFilter =
  | "all"
  | "product"
  | "version"
  | "update_origin"
  | "update_lifecycle"
  | "extended_support";

export interface UmtPlatformStatsRequest {
  platform: string;
  product?: string;
  from?: string;
  to?: string;
  filter: UmtPlatformStatsFilter;
}

// Recharts consumes one object per x-axis value. Every property except month
// is a dynamically named stacked-bar series supplied by the backend.
export type UmtPlatformStatsRow = {
  month: string;
  [series: string]: string | number;
};

export type UmtPlatformStatsNestedWire = Record<string, Record<string, number>>;
export type UmtPlatformStatsFlatWire = Record<string, number>;
export interface UmtPlatformStatsVersionWireItem {
  product: string;
  version: string;
  count: number;
}
export type UmtPlatformStatsVersionWire = Record<string, UmtPlatformStatsVersionWireItem[]>;

export type UmtPlatformStatsWire =
  | UmtPlatformStatsNestedWire
  | UmtPlatformStatsFlatWire
  | UmtPlatformStatsVersionWire;
