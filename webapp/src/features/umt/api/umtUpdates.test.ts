// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import {
  EMPTY_UMT_UPDATE_FILTER_DRAFT,
  EMPTY_UMT_UPDATE_FILTERS,
  activeUmtFilterCount,
  createUmtUpdateSearchRequest,
  filtersFromDraft,
} from "./umtUpdates";

describe("UMT update search wire format", () => {
  it("converts zero-based UI pages to the backend's one-based pages", () => {
    expect(createUmtUpdateSearchRequest(0, 25, EMPTY_UMT_UPDATE_FILTERS)).toMatchObject({
      page: 1,
      pageSize: 25,
    });
    expect(createUmtUpdateSearchRequest(1, 25, EMPTY_UMT_UPDATE_FILTERS).page).toBe(2);
  });

  it("trims filters, sends blanks as null, and serializes dates", () => {
    const filters = filtersFromDraft({
      ...EMPTY_UMT_UPDATE_FILTER_DRAFT,
      assignee: "  user@wso2.com ",
      releasedDate: "2026-09-09",
    });
    expect(filters.assignee).toBe("user@wso2.com");
    expect(filters.id).toBeNull();
    expect(filters.releasedDate).toBe("2026-09-09T00:00:00.000Z");
    expect(activeUmtFilterCount(filters)).toBe(2);
  });
});
