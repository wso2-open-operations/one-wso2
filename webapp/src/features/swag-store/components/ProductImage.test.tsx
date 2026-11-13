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
import { fireEvent, render, screen } from "@testing-library/react";
import ProductImage from "./ProductImage";

const FRONT = "https://wso2.cachefly.net/swag/hoodie-front.png";
const BACK = "https://wso2.cachefly.net/swag/hoodie-back.png";

describe("ProductImage", () => {
  it("shows a placeholder for a photo that fails to load", () => {
    render(<ProductImage src={FRONT} alt="Front" />);
    fireEvent.error(screen.getByRole("img", { name: "Front" }));
    expect(screen.queryByRole("img", { name: "Front" })).toBeNull();
  });

  it("shows the next photo after an earlier one failed", () => {
    const { rerender } = render(<ProductImage src={FRONT} alt="Front" />);
    fireEvent.error(screen.getByRole("img", { name: "Front" }));
    rerender(<ProductImage src={BACK} alt="Back" />);
    expect(screen.getByRole("img", { name: "Back" })).toHaveAttribute("src", BACK);
  });

  it("never loads a photo that isn't https", () => {
    render(<ProductImage src="http://wso2.cachefly.net/swag/hoodie.png" alt="Plain" />);
    expect(screen.queryByRole("img", { name: "Plain" })).toBeNull();
  });
});
