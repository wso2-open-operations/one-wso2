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

import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const asked: boolean[] = [];
let perspective = "finance";

vi.mock("@features/finance/cc/useCcRailBadges", () => ({
  useCcRailBadges: (enabled: boolean) => {
    asked.push(enabled);
    return enabled ? { "cc-autofill-rules": { label: "New", showOnGroup: true } } : {};
  },
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({ key: perspective }),
}));

const { useRailBadges } = await import("./useRailBadges");
const { RailBadgeProvider } = await import("./RailBadgeProvider");

const wrapper = ({ children }: { children: ReactNode }) => <RailBadgeProvider>{children}</RailBadgeProvider>;

/** Shows the badge it reads, as each part of the app that shows badges would. */
function Reader({ name }: { name: string }) {
  const { resolveBadge } = useRailBadges();
  return (
    <p>
      {name}: {resolveBadge("cc-autofill-rules")?.label ?? "none"}
    </p>
  );
}

beforeEach(() => {
  asked.length = 0;
  perspective = "finance";
});

describe("RailBadgeProvider", () => {
  it("shows the Autofill Rules badge in Finance", () => {
    const { result } = renderHook(() => useRailBadges(), { wrapper });

    expect(result.current.resolveBadge("cc-autofill-rules")).toEqual({ label: "New", showOnGroup: true });
  });

  it("asks for card badges only in Finance", () => {
    perspective = "me";
    const { result } = renderHook(() => useRailBadges(), { wrapper });

    expect(asked).toEqual([false]);
    expect(result.current.resolveBadge("cc-autofill-rules")).toBeUndefined();
  });

  it("drops the badge on leaving Finance", () => {
    const { result, rerender } = renderHook(() => useRailBadges(), { wrapper });
    perspective = "me";
    rerender();

    expect(asked.at(-1)).toBe(false);
    expect(result.current.resolveBadge("cc-autofill-rules")).toBeUndefined();
  });

  it("asks each source once, however many places show badges", () => {
    render(
      <RailBadgeProvider>
        <Reader name="Rail" />
        <Reader name="Tabs" />
      </RailBadgeProvider>,
    );

    expect(asked).toEqual([true]);
    expect(screen.getByText("Rail: New")).toBeInTheDocument();
    expect(screen.getByText("Tabs: New")).toBeInTheDocument();
  });
});
