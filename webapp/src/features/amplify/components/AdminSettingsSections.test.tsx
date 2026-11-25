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
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpError } from "@api/http";
import type { AmplifySetting, PointRule } from "../api/amplifyTypes";

type Query<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
};

const h = vi.hoisted(() => ({
  grants: [] as string[],
  scopes: [] as string[],
  settings: undefined as unknown as Query<AmplifySetting[]>,
  rules: undefined as unknown as Query<PointRule[]>,
  values: undefined as unknown as Query<Record<string, number>>,
  // The settings query is a store the form subscribes to, so a refetch re-renders it as React Query would.
  listeners: new Set<() => void>(),
  saveSettings: vi.fn(),
  setRule: vi.fn(),
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
    usePointRules: () => h.rules,
    usePointValues: () => h.values,
  };
});
vi.mock("../api/useAmplifyEditorAccess", () => ({
  useAmplifyGrant: (grant: string) => ({ hasAccess: h.grants.includes(grant), isResolving: false, retry: () => undefined }),
}));
vi.mock("../api/useAmplifyMutations", () => ({
  useSaveSettings: () => ({ mutateAsync: h.saveSettings, isPending: false }),
  useSetPointRule: () => ({ mutateAsync: h.setRule, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: h.showSuccess, showError: h.showError }),
}));

import AdminSettingsForm, {
  MANAGED_BY_ADMINS,
  NEW_ACTIVITY_ONLY_NOTE,
  SAVED_MESSAGE,
  WALLETS_HELP,
  pointValueChanges,
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

const rule = (action: PointRule["action"], points: number, inForce = true): PointRule => ({
  id: `${action}-${points}`,
  action,
  points,
  effectiveFrom: "2026-10-01T00:00:00Z",
  createdBy: "po-1",
  createdAt: "2026-10-01T00:00:00Z",
  inForce,
});

const ok = <T,>(data: T): Query<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

function load(data: AmplifySetting[] | undefined) {
  h.settings = ok(data as AmplifySetting[]);
  for (const listener of h.listeners) listener();
}

beforeEach(() => {
  h.grants = ["CAN_POINT_RULES"];
  h.scopes.length = 0;
  load(poSettings());
  h.rules = ok([
    rule("REPOST", 1, false),
    rule("REPOST", 2),
    rule("REPOST_COMMENTARY", 5),
    rule("OWN_POST", 10),
    rule("OWN_POST_AMPLIFIED", 25),
  ]);
  h.values = ok({ REPOST: 2, REPOST_COMMENTARY: 5, OWN_POST: 10, OWN_POST_AMPLIFIED: 25 });
  h.saveSettings.mockReset().mockResolvedValue({});
  h.setRule.mockReset().mockResolvedValue({});
  h.showSuccess.mockClear();
  h.showError.mockClear();
});

const field = (name: string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
const discard = () => screen.getByRole("button", { name: "Discard" }) as HTMLButtonElement;
const example = () => screen.getByRole("status");

describe("Coins", () => {
  it("reads /po/settings for the PO team and shows the rate, the schedule and a worked example", () => {
    render(<AdminSettingsForm />);
    expect(h.scopes.at(-1)).toBe("po");
    const coins = screen.getByRole("region", { name: "Coins" });
    expect(within(coins).getByText("Conversion rate")).toBeTruthy();
    expect(within(coins).getByText("Points turn into Coins in whole blocks; the rest carries over.")).toBeTruthy();
    expect(field("Points").value).toBe("100");
    expect(field("Coins").value).toBe("10");
    const schedule = screen.getByRole("combobox", { name: "Convert automatically" }) as HTMLSelectElement;
    expect(schedule.value).toBe("MONTHLY");
    expect([...schedule.options].map((o) => o.textContent)).toEqual(["Monthly, on the 1st", "Weekly, on Mondays", "Daily"]);
    expect(example().textContent).toBe(
      "Example at this rate: 1,240 points → 120 Coins, 40 points carry over to the next run.",
    );
  });

  it("works the example out again from the inputs", () => {
    render(<AdminSettingsForm />);
    fireEvent.change(field("Points"), { target: { value: "250" } });
    fireEvent.change(field("Coins"), { target: { value: "30" } });
    expect(example().textContent).toContain("3,100 points → 360 Coins, 100 points carry over");
  });

  it("shows the PO team the wallet switch, off and managed by admins", () => {
    render(<AdminSettingsForm />);
    const toggle = screen.getByRole("switch", { name: "Send Coins to wallets" }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(screen.getByText(`Off · ${MANAGED_BY_ADMINS}`)).toBeTruthy();
    expect(screen.getByText(WALLETS_HELP)).toBeTruthy();
  });

  it.each(["0", "", "2.5", "100001"])("won't save a block of %j and has no example for it", (value) => {
    render(<AdminSettingsForm />);
    fireEvent.change(field("Coins"), { target: { value } });
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Use whole numbers from 1 to 100,000.")).toBeTruthy();
  });

  it("offers a retry when the settings fail to load", () => {
    h.settings = { ...h.settings, data: undefined, isError: true, error: new Error("down") };
    render(<AdminSettingsForm />);
    expect(screen.getByText(/Couldn't load the settings/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.settings.refetch).toHaveBeenCalled();
  });
});

describe("Point values", () => {
  it("shows the six values, the featured one as the extra over approval", () => {
    render(<AdminSettingsForm />);
    expect(field("Repost").value).toBe("2");
    expect(field("Repost with your own thoughts").value).toBe("5");
    expect(field("Reaction on LinkedIn").value).toBe("");
    expect(field("Comment on LinkedIn").value).toBe("");
    expect(field("Own post approved").value).toBe("10");
    expect(field("Own post featured (extra)").value).toBe("15");
    expect(screen.getByText(NEW_ACTIVITY_ONLY_NOTE)).toBeTruthy();
  });

  it("works out which rules to save", () => {
    const saved = { REPOST: 2, OWN_POST: 10, OWN_POST_AMPLIFIED: 25 };
    const texts = {
      REPOST: "3",
      REPOST_COMMENTARY: "",
      REACTION: "1",
      COMMENT: "",
      OWN_POST: "12",
      FEATURED_EXTRA: "15",
    };
    expect(pointValueChanges(saved, texts)).toEqual([
      { action: "REPOST", points: 3 },
      { action: "REACTION", points: 1 },
      { action: "OWN_POST", points: 12 },
      { action: "OWN_POST_AMPLIFIED", points: 27 },
    ]);
    // A value that exists can't be blanked, and a fraction is refused.
    expect(pointValueChanges(saved, { ...texts, REPOST: "" })).toBeNull();
    expect(pointValueChanges(saved, { ...texts, REACTION: "1.5" })).toBeNull();
  });

  it("is read-only for an admin without CAN_POINT_RULES, from GET /point-values", () => {
    h.grants = ["CAN_ADMIN"];
    load(adminSettings());
    render(<AdminSettingsForm />);
    expect(field("Repost").disabled).toBe(true);
    expect(field("Own post featured (extra)").value).toBe("15");
  });
});

describe("Own posts", () => {
  it("shows the daily limit", () => {
    render(<AdminSettingsForm />);
    expect(field("Own posts one person can submit a day").value).toBe("3");
    expect(screen.getByText("0 means no limit.")).toBeTruthy();
  });

  it("won't save a limit above 50", () => {
    render(<AdminSettingsForm />);
    fireEvent.change(field("Own posts one person can submit a day"), { target: { value: "51" } });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText("Use a whole number from 0 to 50.")).toBeTruthy();
  });

  it("leaves the section out when the server doesn't list the limit", () => {
    load(poSettings().filter((s) => s.key !== "external_share.daily_limit"));
    render(<AdminSettingsForm />);
    expect(screen.queryByRole("region", { name: "Own posts" })).toBeNull();
  });
});

describe("Save changes and Discard", () => {
  it("are off until something changes", () => {
    render(<AdminSettingsForm />);
    expect(saveButton().disabled).toBe(true);
    expect(discard().disabled).toBe(true);
  });

  it("save the changed settings with their versions, then each changed point value", async () => {
    render(<AdminSettingsForm />);
    fireEvent.change(field("Points"), { target: { value: "200" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Convert automatically" }), { target: { value: "WEEKLY" } });
    fireEvent.change(field("Own posts one person can submit a day"), { target: { value: "0" } });
    fireEvent.change(field("Repost"), { target: { value: "3" } });
    fireEvent.change(field("Own post featured (extra)"), { target: { value: "20" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith(SAVED_MESSAGE));
    expect(h.saveSettings).toHaveBeenCalledWith({
      scope: "po",
      changes: [
        { key: "coin.block_points", value: 200, version: 3 },
        { key: "coin.schedule", value: "WEEKLY", version: 1 },
        { key: "external_share.daily_limit", value: 0, version: 5 },
      ],
    });
    expect(h.setRule.mock.calls.map((c) => c[0])).toEqual([
      { action: "REPOST", points: 3 },
      { action: "OWN_POST_AMPLIFIED", points: 30 },
    ]);
  });

  it("save an admin's wallet switch to /admin/settings", async () => {
    h.grants = ["CAN_ADMIN"];
    load(adminSettings());
    render(<AdminSettingsForm />);
    expect(h.scopes.at(-1)).toBe("admin");
    fireEvent.click(screen.getByRole("switch", { name: "Send Coins to wallets" }));
    fireEvent.click(saveButton());
    await waitFor(() => expect(h.saveSettings).toHaveBeenCalled());
    expect(h.saveSettings.mock.calls[0][0]).toEqual({
      scope: "admin",
      changes: [{ key: "coin.wallets_enabled", value: true, version: 4 }],
    });
    expect(h.setRule).not.toHaveBeenCalled();
  });

  it("Discard puts the saved values back", () => {
    render(<AdminSettingsForm />);
    fireEvent.change(field("Repost"), { target: { value: "9" } });
    fireEvent.click(discard());
    expect(field("Repost").value).toBe("2");
    expect(saveButton().disabled).toBe(true);
  });

  it("say someone else changed the settings on a 409, and start again from the refreshed values", async () => {
    h.saveSettings.mockRejectedValue(
      new HttpError("/po/settings", 409, JSON.stringify({ status: 409, code: "VERSION_CONFLICT" })),
    );
    render(<AdminSettingsForm />);
    fireEvent.change(field("Points"), { target: { value: "200" } });
    fireEvent.change(field("Repost"), { target: { value: "3" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith(SETTINGS_CONFLICT_MESSAGE));
    expect(h.setRule).not.toHaveBeenCalled();

    // The mutation refetched the settings: someone else had set 150 points (version 4).
    act(() => load([setting("coin.block_points", 150, 4), ...poSettings().slice(1)]));
    expect(field("Points").value).toBe("150");
    expect(saveButton().disabled).toBe(true);
  });

  it("explain a refused point value", async () => {
    h.setRule.mockRejectedValue(new HttpError("/po/point-rules", 422, JSON.stringify({ status: 422, code: "INVALID_SETTING" })));
    render(<AdminSettingsForm />);
    fireEvent.change(field("Repost"), { target: { value: "3" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith("Check the values and try again."));
    expect(h.showSuccess).not.toHaveBeenCalled();
  });
});

describe("who sees it", () => {
  it("shows nothing to a caller with neither grant", () => {
    h.grants = [];
    const { container } = render(<AdminSettingsForm />);
    expect(container.textContent).toBe("");
  });

  it("offers a retry when the point values fail to load", () => {
    h.rules = { ...h.rules, data: undefined, isError: true, error: new Error("down") };
    render(<AdminSettingsForm />);
    expect(screen.getByText(/Couldn't load the point values/)).toBeTruthy();
  });
});
