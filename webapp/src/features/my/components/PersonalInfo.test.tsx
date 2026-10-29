/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EmployeePersonalInfo } from "../api/types";

vi.mock("../api/useUpdatePersonalInfo", () => ({
  useUpdatePersonalInfo: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");
const { default: PersonalInfo } = await import("./PersonalInfo");

const info = (city: string): EmployeePersonalInfo => ({
  id: 1,
  nicOrPassport: "N1",
  firstName: "Jane",
  lastName: "Doe",
  fullName: "Jane Doe",
  title: "Ms",
  dob: "1990-01-01",
  gender: "Female",
  personalEmail: null,
  personalPhone: null,
  residentNumber: null,
  addressLine1: null,
  addressLine2: null,
  city,
  stateOrProvince: null,
  postalCode: null,
  country: null,
  nationality: "Sri Lankan",
  emergencyContacts: null,
});

const card = (personalInfo: EmployeePersonalInfo) => (
  <NotificationsProvider>
    <PersonalInfo personalInfo={personalInfo} employeeId="E1" />
  </NotificationsProvider>
);

describe("PersonalInfo", () => {
  it("shows refreshed details while not editing", () => {
    const { rerender } = render(card(info("Colombo")));
    expect(screen.getByText("Colombo")).toBeInTheDocument();

    rerender(card(info("Kandy")));

    expect(screen.getByText("Kandy")).toBeInTheDocument();
  });

  it("keeps an edit in progress when the details refresh", async () => {
    const { rerender } = render(card(info("Colombo")));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const city = screen.getByDisplayValue("Colombo");
    await userEvent.clear(city);
    await userEvent.type(city, "Galle");

    rerender(card(info("Kandy")));

    expect(screen.getByDisplayValue("Galle")).toBeInTheDocument();
  });

  it("returns to the latest details when an edit is cancelled", async () => {
    const { rerender } = render(card(info("Colombo")));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByDisplayValue("Colombo"), "x");
    rerender(card(info("Kandy")));

    await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(screen.getByText("Kandy")).toBeInTheDocument();
  });
});
