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
import type { EmergencyContact } from "../api/types";

vi.mock("../api/useUpdatePersonalInfo", () => ({
  useUpdatePersonalInfo: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");
const { default: EmergencyContacts } = await import("./EmergencyContacts");

const contact = (name: string): EmergencyContact => ({
  name,
  relationship: "Sibling",
  telephone: null,
  mobile: "0771234567",
});

const card = (contacts: EmergencyContact[]) => (
  <NotificationsProvider>
    <EmergencyContacts contacts={contacts} employeeId="E1" />
  </NotificationsProvider>
);

describe("EmergencyContacts", () => {
  it("shows refreshed contacts while not editing", () => {
    const { rerender } = render(card([contact("Asha")]));
    expect(screen.getByText("Asha")).toBeInTheDocument();

    rerender(card([contact("Ravi")]));

    expect(screen.getByText("Ravi")).toBeInTheDocument();
  });

  it("keeps an edit in progress when the contacts refresh", async () => {
    const { rerender } = render(card([contact("Asha")]));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const name = screen.getByDisplayValue("Asha");
    await userEvent.clear(name);
    await userEvent.type(name, "Nimal");

    rerender(card([contact("Ravi")]));

    expect(screen.getByDisplayValue("Nimal")).toBeInTheDocument();
  });
});
