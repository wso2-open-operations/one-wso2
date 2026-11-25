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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { HttpError } from "@api/http";
import type { AmplifySetting } from "../api/amplifyTypes";

type SettingsQuery = {
  data: AmplifySetting[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
};

const h = vi.hoisted(() => ({
  grants: [] as string[],
  scopes: [] as string[],
  settings: undefined as unknown as SettingsQuery,
  // The settings query is a store the section subscribes to, so a refetch re-renders it as React Query would.
  listeners: new Set<() => void>(),
  mutate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("../api/useAmplifyData", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (listener: () => void) => {
    h.listeners.add(listener);
    return () => void h.listeners.delete(listener);
  };
  return {
    useAmplifySettings: (scope: string) => {
      h.scopes.push(scope);
      return useSyncExternalStore(subscribe, () => h.settings);
    },
  };
});
vi.mock("../api/useAmplifyEditorAccess", () => ({
  useAmplifyGrant: (grant: string) => ({ hasAccess: h.grants.includes(grant), isResolving: false, retry: () => undefined }),
}));
vi.mock("../api/useAmplifyMutations", () => ({ useSaveSettings: () => ({ mutate: h.mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: h.showSuccess, showError: h.showError }),
}));
vi.mock("./AmplifyShell", () => ({
  AmplifyPanel: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

import {
  CoinsSection,
  MANAGED_BY_ADMINS,
  NEW_SUBMISSIONS_NOTE,
  NEXT_RUN_NOTE,
  OwnPostsSection,
  WALLETS_HELP,
} from "./AdminSettingsSections";
import { SETTINGS_CONFLICT_MESSAGE } from "../util/amplifyError";

const setting = (key: string, value: unknown, version: number): AmplifySetting => ({
  key,
  value,
  version,
  updatedBy: "po-1",
  updatedAt: "2026-11-01T00:00:00Z",
});

const poSettings = (): AmplifySetting[] => [
  setting("coin.block_points", 100, 3),
  setting("coin.block_coins", 10, 2),
  setting("coin.schedule", "MONTHLY", 1),
  setting("external_share.daily_limit", 3, 5),
];

const adminSettings = (): AmplifySetting[] => [...poSettings(), setting("coin.wallets_enabled", false, 4)];

function load(data: AmplifySetting[] | undefined) {
  h.settings = { data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() };
  for (const listener of h.listeners) listener();
}

beforeEach(() => {
  h.grants = ["CAN_POINT_RULES"];
  h.scopes.length = 0;
  load(poSettings());
  h.mutate.mockReset();
  h.showSuccess.mockClear();
  h.showError.mockClear();
});

const field = (name: string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
const example = () => screen.getByRole("status");

describe("Coins, for the PO team", () => {
  it("reads /po/settings and shows the rate, the schedule and a worked example", () => {
    render(<CoinsSection />);
    expect(h.scopes.at(-1)).toBe("po");
    expect(field("Points").value).toBe("100");
    expect(field("Coins").value).toBe("10");
    expect((screen.getByRole("radio", { name: "Monthly on the 1st" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("radio", { name: "Weekly on Mondays" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Daily" })).toBeTruthy();
    expect(example().textContent).toContain("1,240 points becomes 120 Coins, with 40 points carried over.");
    expect(screen.getByText(NEXT_RUN_NOTE)).toBeTruthy();
  });

  it("works the example out again from the inputs", () => {
    render(<CoinsSection />);
    fireEvent.change(field("Points"), { target: { value: "250" } });
    fireEvent.change(field("Coins"), { target: { value: "30" } });
    expect(example().textContent).toContain("3,100 points becomes 360 Coins, with 100 points carried over.");
  });

  it("shows the wallet switch as managed by admins, with its help text", () => {
    render(<CoinsSection />);
    expect(screen.queryByRole("switch", { name: "Send Coins to wallets" })).toBeNull();
    expect(screen.getByText(MANAGED_BY_ADMINS)).toBeTruthy();
    expect(screen.getByText(WALLETS_HELP)).toBeTruthy();
  });

  it("saves only the changed keys, each with its version, to /po/settings", () => {
    h.mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<CoinsSection />);
    expect(save().disabled).toBe(true);
    fireEvent.change(field("Points"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("radio", { name: "Weekly on Mondays" }));
    fireEvent.click(save());
    expect(h.mutate.mock.calls[0][0]).toEqual({
      scope: "po",
      changes: [
        { key: "coin.block_points", value: 200, version: 3 },
        { key: "coin.schedule", value: "WEEKLY", version: 1 },
      ],
    });
    expect(h.showSuccess).toHaveBeenCalledWith("Coins settings saved. They apply from the next run.");
  });

  it.each(["0", "", "2.5", "100001"])("won't save a block of %j and has no example for it", (value) => {
    render(<CoinsSection />);
    fireEvent.change(field("Coins"), { target: { value } });
    expect(save().disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Use whole numbers from 1 to 100,000.")).toBeTruthy();
  });

  it("says someone else changed the settings on a 409, and starts again from the refreshed values", () => {
    h.mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new HttpError("/po/settings", 409, JSON.stringify({ status: 409, code: "VERSION_CONFLICT" }))),
    );
    render(<CoinsSection />);
    fireEvent.change(field("Points"), { target: { value: "200" } });
    fireEvent.click(save());
    expect(h.showError).toHaveBeenCalledWith(SETTINGS_CONFLICT_MESSAGE);

    // The mutation refetched the settings: someone else had set 150 points (version 4).
    act(() => load([setting("coin.block_points", 150, 4), ...poSettings().slice(1)]));
    expect(field("Points").value).toBe("150");
    expect(save().disabled).toBe(true);
  });

  it("explains a refused value", () => {
    h.mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new HttpError("/po/settings", 422, JSON.stringify({ status: 422, code: "INVALID_SETTING" }))),
    );
    render(<CoinsSection />);
    fireEvent.change(field("Coins"), { target: { value: "20" } });
    fireEvent.click(save());
    expect(h.showError).toHaveBeenCalledWith("Check the values and try again.");
  });

  it("offers a retry when the settings fail to load", () => {
    h.settings = { ...h.settings, data: undefined, isError: true, error: new Error("down") };
    render(<CoinsSection />);
    expect(screen.getByText(/Couldn't load the settings/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.settings.refetch).toHaveBeenCalled();
  });
});

describe("Coins, for an admin", () => {
  beforeEach(() => {
    h.grants = ["CAN_ADMIN"];
    load(adminSettings());
  });

  it("reads /admin/settings and offers the wallet switch", () => {
    render(<CoinsSection />);
    expect(h.scopes.at(-1)).toBe("admin");
    const toggle = screen.getByRole("switch", { name: "Send Coins to wallets" }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.queryByText(MANAGED_BY_ADMINS)).toBeNull();
    expect(screen.getByText(WALLETS_HELP)).toBeTruthy();
  });

  it("saves the switch with its version to /admin/settings", () => {
    render(<CoinsSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Send Coins to wallets" }));
    fireEvent.click(save());
    expect(h.mutate.mock.calls[0][0]).toEqual({
      scope: "admin",
      changes: [{ key: "coin.wallets_enabled", value: true, version: 4 }],
    });
  });

  it("uses /admin/settings for the rate too when the admin is also on the PO team", () => {
    h.grants = ["CAN_ADMIN", "CAN_POINT_RULES"];
    render(<CoinsSection />);
    fireEvent.change(field("Coins"), { target: { value: "12" } });
    fireEvent.click(save());
    expect(h.mutate.mock.calls[0][0]).toEqual({
      scope: "admin",
      changes: [{ key: "coin.block_coins", value: 12, version: 2 }],
    });
  });
});

describe("Own posts", () => {
  it("shows the daily limit and saves a new one with its version", () => {
    h.mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<OwnPostsSection />);
    const limit = field("Own posts per person per day");
    expect(limit.value).toBe("3");
    expect(screen.getByText("0 means no limit.")).toBeTruthy();
    expect(screen.getByText(NEW_SUBMISSIONS_NOTE)).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.change(limit, { target: { value: "0" } });
    fireEvent.click(save());
    expect(h.mutate.mock.calls[0][0]).toEqual({
      scope: "po",
      changes: [{ key: "external_share.daily_limit", value: 0, version: 5 }],
    });
    expect(h.showSuccess).toHaveBeenCalledWith("Own-post daily limit saved.");
  });

  it("won't save a limit above 50", () => {
    render(<OwnPostsSection />);
    fireEvent.change(field("Own posts per person per day"), { target: { value: "51" } });
    expect(save().disabled).toBe(true);
    expect(screen.getByText("Use a whole number from 0 to 50.")).toBeTruthy();
  });

  it("says so when the server doesn't list the limit", () => {
    load(poSettings().filter((s) => s.key !== "external_share.daily_limit"));
    render(<OwnPostsSection />);
    expect(screen.getByText(/isn't available yet/)).toBeTruthy();
  });
});
