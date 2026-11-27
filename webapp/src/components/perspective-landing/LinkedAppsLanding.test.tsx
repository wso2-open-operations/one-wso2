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

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router";
import LinkedAppsLanding from "./LinkedAppsLanding";

describe("LinkedAppsLanding", () => {
  it("lists the perspective's configured apps, each opening in a new tab", () => {
    render(
      <LinkedAppsLanding
        perspective="customer-success"
        urls={{ "cs-tools": "https://cs-tools.example", explorecs: "https://explorecs.example", netsuite: "https://ns.example" }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Customer Success" })).toBeInTheDocument();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["https://explorecs.example", "https://cs-tools.example"]);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent("(opens in a new tab)");
    }
    expect(links[1]).toHaveTextContent("CS Tools");
  });

  it("marks an app reachable only on the VPN", () => {
    render(<LinkedAppsLanding perspective="infra" urls={{ "guest-wifi": "https://wifi.example" }} />);
    expect(screen.getByRole("link")).toHaveTextContent("Guest WiFi (VPN)");
  });

  it("says there is nothing here when none of its apps is configured", () => {
    render(
      <MemoryRouter>
        <LinkedAppsLanding perspective="customer-success" urls={{}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Customer Success" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
