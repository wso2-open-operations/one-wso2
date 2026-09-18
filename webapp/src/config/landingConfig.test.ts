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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLandingKey,
  landingOptions,
  landingPath,
  landingPathFor,
  landingPreference,
  setLandingPreference,
} from "@config/landingConfig";
import { PERSPECTIVES, reachablePerspectives } from "@constants/perspectives";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("landing options", () => {
  it("offers only perspectives that are built and routable", () => {
    for (const o of landingOptions()) {
      const def = PERSPECTIVES.find((p) => p.key === o.key);
      expect(def?.access).toBe(true);
      expect(o.path.startsWith("/")).toBe(true);
    }
  });

  // Derived from the registry rather than a hardcoded list, which went stale the
  // moment the unbuilt placeholders were removed: the old assertion named keys
  // that no longer exist and passed by saying nothing.
  it("excludes anything without a route of its own", () => {
    const keys = landingOptions().map((o) => o.key);
    const unlandable = PERSPECTIVES.filter((p) => !p.access || !p.path);
    expect(unlandable.length, "no unlandable perspective left to check").toBeGreaterThan(0);
    for (const p of unlandable) {
      expect(keys, `"${p.key}" should not be landable`).not.toContain(p.key);
    }
  });

  it("always includes Me, which is the fallback", () => {
    expect(landingOptions().map((o) => o.key)).toContain("me");
  });

  it("still counts a gated perspective as reachable, for surfaces the user drives", () => {
    // The rail, launcher and favourites keep offering them — there the gate's
    // own message is the right answer to a deliberate click.
    expect(reachablePerspectives().map((p) => p.key)).toContain("marketing");
  });

  it("offers a gated perspective to a person choosing for themselves", () => {
    // Someone who works in Marketing Ops all day should be able to open there.
    // They are the only one affected, and an authorized caller gets the real
    // page — only an unauthorized one meets the locked door, which is the same
    // screen the launcher would have given them anyway.
    expect(landingOptions().map((o) => o.key)).toContain("marketing");
  });

  it("offers Infra Portal to a person choosing for themselves", () => {
    expect(landingOptions().map((o) => o.key)).toContain("infra");
  });
});

describe("landingPath", () => {
  it("is Me until the user says otherwise", () => {
    // The only default there is. A deployment-wide ONE_WSO2_DEFAULT_PERSPECTIVE
    // used to sit underneath this; it bought nothing that a user setting their
    // own does not.
    expect(landingPath()).toBe("/me");
  });

  it("honours the user's choice", () => {
    setLandingPreference("finance");
    expect(landingPath()).toBe("/finance");
  });

  it("honours an externally gated one, chosen personally", () => {
    setLandingPreference("marketing");
    expect(landingPath()).toBe("/marketing-ops");
  });

  it("falls back on a routeless perspective rather than stranding the user", () => {
    // "csm" is in the registry but lives in another application, so it has no
    // route here; landing there would hit the catch-all and bounce.
    setLandingPreference("csm");
    expect(landingPath()).toBe("/me");
  });

  it("never resolves to the index itself", () => {
    // "/" would make the index route redirect to itself forever.
    for (const o of landingOptions()) {
      expect(landingPathFor(o.key)).not.toBe("/");
    }
    expect(landingPathFor(undefined)).not.toBe("/");
  });
});

describe("isLandingKey", () => {
  it("accepts landable keys and rejects everything else", () => {
    expect(isLandingKey("me")).toBe(true);
    expect(isLandingKey("csm")).toBe(false);
    expect(isLandingKey("")).toBe(false);
    expect(isLandingKey(undefined)).toBe(false);
    expect(isLandingKey({ key: "me" })).toBe(false);
  });
});

describe("per-user preference", () => {
  it("is absent until the user chooses", () => {
    expect(landingPreference()).toBeUndefined();
    expect(landingPath()).toBe("/me");
  });

  it("persists a choice", () => {
    setLandingPreference("finance");
    expect(landingPreference()).toBe("finance");
    expect(landingPath()).toBe("/finance");
  });

  it("clearing it returns the user to Me", () => {
    setLandingPreference("finance");
    setLandingPreference(undefined);
    expect(landingPreference()).toBeUndefined();
    expect(landingPath()).toBe("/me");
  });

  it("ignores a stored value that is not landable", () => {
    localStorage.setItem("one-wso2.landing", "csm");
    expect(landingPreference()).toBeUndefined();
    expect(landingPath()).toBe("/me");
  });

  it("refuses to store an unlandable key", () => {
    setLandingPreference("csm");
    expect(landingPreference()).toBeUndefined();
  });
});
