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

import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { UMT_DOCUMENTATION_URL_KEY, openUmtDocumentation } from "./umtDocumentation";

describe("openUmtDocumentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the cached link in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const queryClient = new QueryClient();
    queryClient.setQueryData(UMT_DOCUMENTATION_URL_KEY, "https://docs.example.com/umt");

    openUmtDocumentation({ queryClient });
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith("https://docs.example.com/umt", "_blank", "noopener,noreferrer");
  });

  it("does nothing while the link is not in the cache, or is empty", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const queryClient = new QueryClient();

    openUmtDocumentation({ queryClient });
    queryClient.setQueryData(UMT_DOCUMENTATION_URL_KEY, "");
    openUmtDocumentation({ queryClient });
    expect(open).not.toHaveBeenCalled();
  });
});
