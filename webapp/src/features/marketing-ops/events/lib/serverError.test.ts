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

import { describe, expect, it } from "vitest";
import { HttpError } from "@api/http";
import { describeEventsError, serverDetail } from "./serverError";

describe("describeEventsError", () => {
  it("reads the message FastAPI puts in detail", () => {
    const err = new HttpError("/api/events/submissions/x/submit", 409, JSON.stringify({
      detail: { code: "CHANGED_DURING_REVIEW", message: "The list changed while it was being checked." },
    }));
    expect(serverDetail(err)?.code).toBe("CHANGED_DURING_REVIEW");
    expect(describeEventsError(err)).toBe("The list changed while it was being checked.");
  });

  it("falls back to describeError for anything else", () => {
    expect(describeEventsError(new HttpError("/x", 500, "<html>"))).toMatch(/HTTP 500/);
    expect(describeEventsError(new Error("offline"))).toBe("offline");
  });
});
