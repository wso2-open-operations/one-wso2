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

import { useId } from "react";

// The Docker whale inside a circular "retry" arrow, marking the action that
// retriggers a chunk's failed docker builds.
//
// Drawn in currentColor, like every icon from @wso2/oxygen-ui-icons-react, so
// it takes its colour from the button around it and follows the theme. Where
// the whale overlaps the arrow, a mask cuts a thin gap out of the arrow
// rather than outlining the whale in a fixed colour, which would only read
// against one background.
//
// The drawing spans 244 units and sits centred in a viewBox it fills five
// sixths of — the same share a 24-unit icon's 20-unit live area fills inside
// its 2-unit inset — so it reads at the same size as the icons beside it.
//
// Inlined rather than imported as a file because the portal has no SVG-asset
// pipeline; every other icon here arrives as a component too.

const ARROW_PATH =
  "m102,224.17067q-39.15312,0 -66.32656,-27.17344t-27.17344,-66.32656q0,-39.15313 27.17344,-66.32656t66.32656,-27.17344q20.16094,0 38.56875,8.32734t31.55625,23.81328l0,-32.14063l23.375,0l0,81.8125l-81.8125,0l0,-23.375l49.0875,0q-9.35,-16.3625 -25.56641,-25.7125t-35.20859,-9.35q-29.21875,0 -49.67188,20.45313t-20.45313,49.67188q0,29.21875 20.45313,49.67188t49.67188,20.45313q22.49844,0 40.61406,-12.85625t25.42031,-33.89375l24.54375,0q-8.18125,30.97187 -33.30937,50.54844t-57.26875,19.57656z";

const WHALE_PATH =
  "m178.21582,174.15466l14.65641,0a1.2865,1.2865 0 0 0 1.2865,-1.27958l0,-13.05175a1.2865,1.2865 0 0 0 -1.2865,-1.2865l-14.65641,0a1.27958,1.27958 0 0 0 -1.27958,1.27958l0,13.05866c0,0.7055 0.57408,1.27958 1.27958,1.27958m-20.43183,-37.55749l14.64949,0a1.2865,1.2865 0 0 0 1.2865,-1.2865l0,-13.05866a1.2865,1.2865 0 0 0 -1.2865,-1.27958l-14.64949,0a1.27958,1.27958 0 0 0 -1.27958,1.27958l0,13.05866c0,0.7055 0.56717,1.27958 1.27958,1.27958m0,18.78566l14.64949,0a1.29341,1.29341 0 0 0 1.2865,-1.2865l0,-13.05175a1.2865,1.2865 0 0 0 -1.2865,-1.27958l-14.64949,0a1.27958,1.27958 0 0 0 -1.27958,1.27958l0,13.05175c0,0.7055 0.56717,1.27958 1.27958,1.2865m-20.26583,0l14.66333,0a1.2865,1.2865 0 0 0 1.27267,-1.2865l0,-13.05175a1.27958,1.27958 0 0 0 -1.27958,-1.27958l-14.64949,0a1.27958,1.27958 0 0 0 -1.27958,1.27958l0,13.05175c0,0.7055 0.57408,1.27958 1.27958,1.2865m-20.50099,0l14.65641,0a1.2865,1.2865 0 0 0 1.27958,-1.2865l0,-13.05175a1.27958,1.27958 0 0 0 -1.27958,-1.27958l-14.65641,0a1.2865,1.2865 0 0 0 -1.2865,1.27958l0,13.05175c0,0.7055 0.581,1.27958 1.2865,1.2865m40.75991,18.77875l14.64949,0a1.2865,1.2865 0 0 0 1.2865,-1.27958l0,-13.05175a1.2865,1.2865 0 0 0 -1.2865,-1.2865l-14.64949,0a1.27958,1.27958 0 0 0 -1.27958,1.27958l0,13.05866c0,0.7055 0.56717,1.27958 1.27958,1.27958m-20.26583,0l14.66333,0a1.27958,1.27958 0 0 0 1.27267,-1.27958l0,-13.05175a1.27958,1.27958 0 0 0 -1.27267,-1.2865l-14.66333,0a1.27958,1.27958 0 0 0 -1.27267,1.27958l0,13.05866c0,0.7055 0.57408,1.27958 1.27958,1.27958m-20.50099,0l14.65641,0a1.27958,1.27958 0 0 0 1.27958,-1.27958l0,-13.05175a1.27958,1.27958 0 0 0 -1.27267,-1.2865l-14.66333,0a1.2865,1.2865 0 0 0 -1.2865,1.2865l0,13.05175c0,0.7055 0.581,1.27958 1.2865,1.27958m-20.19666,0l14.66333,0a1.27958,1.27958 0 0 0 1.27267,-1.27958l0,-13.05175a1.27958,1.27958 0 0 0 -1.27267,-1.2865l-14.66333,0a1.27958,1.27958 0 0 0 -1.27267,1.27958l0,13.05866c0,0.7055 0.56717,1.27958 1.27958,1.27958m149.02646,-8.217c-0.44958,-0.35275 -4.648,-3.5275 -13.51516,-3.5275c-2.33783,0.00691 -4.67567,0.2075 -6.98583,0.60175c-1.71533,-11.75833 -11.43325,-17.49916 -11.86899,-17.74816l-2.37933,-1.37641l-1.56317,2.26175c-1.96433,3.0295 -3.38917,6.37717 -4.233,9.89083c-1.59083,6.70917 -0.6225,13.01716 2.78741,18.40525c-4.11541,2.29633 -10.72083,2.85658 -12.06266,2.905l-109.34556,0a5.19441,5.19441 0 0 0 -5.1875,5.17367a78.68398,78.68398 0 0 0 4.78633,28.0955c3.76958,9.877 9.37208,17.15333 16.66916,21.60766c8.16167,5.00075 21.44166,7.86425 36.48541,7.86425c6.79908,0.02075 13.57741,-0.59483 20.26583,-1.83983a84.71531,84.71531 0 0 0 26.44241,-9.60725c6.77833,-3.92175 12.86499,-8.90867 18.05249,-14.77399c8.65967,-9.80783 13.81949,-20.72925 17.65825,-30.43333l1.52858,0c9.48967,0 15.32041,-3.79725 18.53666,-6.97891c2.13725,-2.02658 3.80417,-4.49583 4.89008,-7.23483l0.67783,-1.992l-1.63925,-1.29341l0.00001,-0.00001z";

export default function UmtDockerRetriggerIcon({ size = 24 }: { size?: number }) {
  // One mask per rendered icon, since every docker-failed row draws one. The
  // id is filtered to characters that are always safe inside url(#...).
  const maskId = `umt-docker-retrigger-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-18.4 -27.4 292.8 292.8"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="6" y="-3" width="244" height="244">
        <rect x="6" y="-3" width="244" height="244" fill="white" />
        <path d={WHALE_PATH} fill="black" stroke="black" strokeWidth={24} />
      </mask>
      {/* The mask sits on the group, not the rotated path, so that it is
          laid out in the same unrotated space as the whale it cuts around. */}
      <g mask={`url(#${maskId})`}>
        <path d={ARROW_PATH} transform="rotate(-47.0599 102 130.671)" />
      </g>
      <path d={WHALE_PATH} />
    </svg>
  );
}
