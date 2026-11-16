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

/** The dropdown caret every Select in the app uses (set as the theme default).
 *
 * Oxygen's default is a 24px lucide chevron with a 2px stroke. Its fixed
 * width/height attributes ignore the `fontSize` our compact 32px filter pills
 * set, so it rendered oversized, heavy and slightly off-centre. This one is a
 * fixed 12px caret with a lighter stroke that inherits the text colour, so the
 * per-page colour overrides (`.MuiSelect-icon { color }`) still apply. MUI
 * passes `className` (MuiSelect-icon / MuiSelect-iconOpen), which positions it
 * and flips it while the menu is open — see the theme's MuiSelect overrides.
 */
export default function SelectChevron({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}
