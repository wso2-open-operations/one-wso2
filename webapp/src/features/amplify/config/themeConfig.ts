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

// Amplify-only colours. Kept apart from src/config/themeConfig.ts, which stays the
// theme picker: nothing here overrides or reads a parent theme colour, it only adds
// names the dashboards need. Every dashboard bar and line uses one of these two.
// (The top-3 medal colours are deliberately not here; they stay hardcoded where they are.)

export const AMPLIFY_BAR = {
  /** Healthy / on-track / "more is good" bars and lines. */
  positive: "#089c2f",
  /** Problem bars: failed shares, expired connections. */
  negative: "#d92c16",
} as const;
