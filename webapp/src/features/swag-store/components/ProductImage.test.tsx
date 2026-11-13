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

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ProductImage from "./ProductImage";

const FRONT = "https://acc.blob.core.windows.net/c/products/x/front-3f9a2c1d.jpg?sig=x";
const BACK = "https://acc.blob.core.windows.net/c/products/x/back-0a1b2c3d.jpg?sig=y";

afterEach(() => vi.unstubAllEnvs());

describe("ProductImage", () => {
  it("shows the placeholder when there is no photo", () => {
    const { container } = render(<ProductImage src={null} alt="Hoodie" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows an https photo", () => {
    render(<ProductImage src={FRONT} alt="Hoodie" />);
    expect(screen.getByRole("img", { name: "Hoodie" })).toHaveAttribute("src", FRONT);
  });

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

  it("allows the local emulator over http only in a dev build", () => {
    const local = "http://127.0.0.1:10000/devstoreaccount1/swag-store-assets/products/x/front-3f9a2c1d.jpg?sig=x";
    vi.stubEnv("DEV", true);
    const { unmount } = render(<ProductImage src={local} alt="Hoodie" />);
    expect(screen.getByRole("img", { name: "Hoodie" })).toBeInTheDocument();
    unmount();
    vi.stubEnv("DEV", false);
    render(<ProductImage src={local} alt="Hoodie" />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("never loads plain http from another host", () => {
    vi.stubEnv("DEV", true);
    render(<ProductImage src="http://wso2.cachefly.net/swag/hoodie.png" alt="Plain" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
