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

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SmallDealBanner from "./SmallDealBanner";

// 2026-10-24: under USD 30,000 of TCV, the AM is asked to talk to their managers.
describe("SmallDealBanner", () => {
  it("asks the AM to contact the Sales Manager and the BU GM", () => {
    render(<SmallDealBanner smallDeal={{ thresholdUsd: "30000.00", tcvUsd: "6480.00" }} currency="USD" tcv="6480.00" />);
    const banner = screen.getByLabelText("Small deal");
    expect(banner).toHaveTextContent("Deal under USD 30,000");
    expect(banner).toHaveTextContent("The total contract value is USD 6,480.00. Contact your Sales Manager and the BU GM about this deal.");
  });

  it("shows the quote's own currency with the USD value", () => {
    render(<SmallDealBanner smallDeal={{ thresholdUsd: "30000.00", tcvUsd: "22500.00" }} currency="GBP" tcv="18000.00" />);
    expect(screen.getByLabelText("Small deal")).toHaveTextContent("GBP 18,000.00 (about USD 22,500.00)");
  });

  it("shows nothing for a larger deal", () => {
    const { container } = render(<SmallDealBanner smallDeal={null} currency="USD" tcv="94440.00" />);
    expect(container).toBeEmptyDOMElement();
  });
});
