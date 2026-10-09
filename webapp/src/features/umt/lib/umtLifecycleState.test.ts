// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { UMT_LIFECYCLE_STATES, UMT_LIFECYCLES } from "../api/umtTypes";
import { umtLifecycle, umtLifecycleState } from "./umtLifecycleState";

describe("umtLifecycleState", () => {
  it("returns every known state unchanged", () => {
    for (const state of UMT_LIFECYCLE_STATES) {
      expect(umtLifecycleState(state)).toBe(state);
    }
  });

  it("returns undefined for an unknown, empty or missing state", () => {
    expect(umtLifecycleState("SomeFutureState")).toBeUndefined();
    expect(umtLifecycleState("development")).toBeUndefined();
    expect(umtLifecycleState("")).toBeUndefined();
    expect(umtLifecycleState(null)).toBeUndefined();
    expect(umtLifecycleState(undefined)).toBeUndefined();
  });
});

describe("umtLifecycle", () => {
  it("returns every known lifecycle unchanged", () => {
    for (const lifecycle of UMT_LIFECYCLES) {
      expect(umtLifecycle(lifecycle)).toBe(lifecycle);
    }
  });

  it("returns undefined for an unknown or missing lifecycle", () => {
    expect(umtLifecycle("SomeFutureLifecycle")).toBeUndefined();
    expect(umtLifecycle(null)).toBeUndefined();
    expect(umtLifecycle(undefined)).toBeUndefined();
  });
});
