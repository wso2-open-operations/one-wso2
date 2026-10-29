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

import type { PerspectiveSection } from "@constants/perspectives";
import { describe, expect, it } from "vitest";
import { groupNeedsAttention, type RailBadge } from "./railBadge";

const outdated: RailBadge = { label: "Fix", reason: "A rule is outdated." };
const unconfigured: RailBadge = { label: "Set up", reason: "A rule needs setting up." };

describe("groupNeedsAttention", () => {
  const group: PerspectiveSection = {
    id: "cc",
    label: "Credit Card Expenses",
    children: [
      { id: "cc-new", label: "Pending Submissions" },
      { id: "cc-settings", label: "Settings" },
    ],
  };
  const visibleToAll = () => true;
  const onGroup = (badge: RailBadge): RailBadge => ({ ...badge, showOnGroup: true });

  it("is false when the children's badges stay on their own rows, as they do by default", () => {
    const badges: Record<string, RailBadge> = { "cc-new": unconfigured, "cc-settings": outdated };
    expect(groupNeedsAttention(group, (id) => badges[id], visibleToAll)).toBe(false);
  });

  it("is true when a child's badge asks to show on the group", () => {
    const badges: Record<string, RailBadge> = { "cc-new": unconfigured, "cc-settings": onGroup(outdated) };
    expect(groupNeedsAttention(group, (id) => badges[id], visibleToAll)).toBe(true);
  });

  it("is true when the group has a badge of its own", () => {
    const badges: Record<string, RailBadge> = { cc: unconfigured };
    expect(groupNeedsAttention(group, (id) => badges[id], visibleToAll)).toBe(true);
  });

  it("ignores the badge of a child the person can't see", () => {
    const badges: Record<string, RailBadge> = { "cc-settings": onGroup(outdated) };
    const hideSettings = (s: PerspectiveSection) => s.id !== "cc-settings";
    expect(groupNeedsAttention(group, (id) => badges[id], hideSettings)).toBe(false);
  });
});
