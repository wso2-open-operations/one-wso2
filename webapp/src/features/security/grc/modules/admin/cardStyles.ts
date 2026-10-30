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

// RETHEMED FOR THIS APP. The rest of the lifted tree is the source's code
// unedited; this file is not, and the reason is that its original values were
// written against a theme this app no longer uses.
//
// The source hardcoded `#ffffff` / `#1a1a24` to opt a dialog out of
// AcrylicOrangeTheme's translucent, blurred Paper — correct there, wrong here.
// This app now defaults to Oxygen's WSO2Theme, whose paper is also translucent
// (`#ffffffc5` light, `#00000026` dark) over a navy dark canvas (`#0b142b`),
// so a literal `#1a1a24` would sit as a visibly different shade against it,
// and a theme switch would strand both values entirely.
//
// The OPT-OUT is still wanted — a dense form dialog reads as unreadably
// transparent through glassmorphism. What changes is how it is expressed:
// `background.default` is the theme's own opaque canvas colour, read as a CSS
// variable so it follows the active theme, including one nobody has added yet.
// Variables rather than `theme.palette.*` because that accessor freezes the
// light scheme's value at first paint under CssVarsProvider — the same trap
// documented in this app's own due-diligence and expense screens.

export const dialogPaperSx = {
  backdropFilter: "none",
  backgroundImage: "none",
  backgroundColor: "var(--oxygen-palette-background-default)",
};
