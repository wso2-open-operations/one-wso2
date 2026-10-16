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

/** Props the rail hands an icon: Sidebar.ItemIcon sets `size` (20) on whatever it wraps. */
export interface RailIconProps {
  size?: number | string;
}

// A product's own logo, drawn where the rail would otherwise put a line icon. The image is
// decorative: the row's label already names the product, so a screen reader hears it once.
function logoIcon(src: string, displayName: string) {
  const Logo = ({ size = 20 }: RailIconProps): JSX.Element => (
    <img src={src} alt="" width={size} height={size} style={{ display: "block", objectFit: "contain" }} />
  );
  Logo.displayName = displayName;
  return Logo;
}

/** Echo, the call-intelligence product (public/echo-logo.png). */
export const EchoLogoIcon = logoIcon("/echo-logo.png", "EchoLogoIcon");

/** Sales Pitstop, the sales content hub the Library searches (public/sales-pitstop-logo.png). */
export const SalesPitstopLogoIcon = logoIcon("/sales-pitstop-logo.png", "SalesPitstopLogoIcon");
