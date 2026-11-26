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

/**
 * Corner radius for Amplify's cards, tiles, panels, table frames, notices and inputs: a fixed 8px, not a theme
 * multiple, because the themes' radius unit differs (12px in the Choreo Labs theme, 8px in the Pale themes, 20px in
 * WSO2), so `borderRadius: 2` drew 24px corners. Capsule pills and progress bars keep their own rounding.
 */
export const AMPLIFY_RADIUS = "8px";

/** For an image or a box inside a card (the post image, the activity summary in a correction panel). */
export const AMPLIFY_INNER_RADIUS = "6px";

/** Scoped to an Amplify page or dialog: its outlined inputs, notices and outlined papers take the same corners. */
export const amplifyRadiusSx = {
  "& .MuiOutlinedInput-root, & .MuiAlert-root, & .MuiPaper-outlined": { borderRadius: AMPLIFY_RADIUS },
} as const;
