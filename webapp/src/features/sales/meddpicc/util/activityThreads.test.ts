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
import type { DealActivity } from "../types";
import { threadActivity, threadSubject } from "./activityThreads";

const email = (id: string, title: string, occurredAt: string): DealActivity => ({
  type: "EMAIL", kind: "EMAIL", id, title, occurredAt, actor: "Ravi Kumar", letters: [], meetingId: null, url: null,
});
const call = (id: string, occurredAt: string): DealActivity => ({
  type: "CALL", kind: "CUSTOMER_CALL", id, title: "Discovery", occurredAt, actor: "ravi@wso2.com", letters: [], meetingId: Number(id), url: null,
});

describe("threadSubject", () => {
  it("strips the reply and forward prefixes, however many and in whatever case", () => {
    expect(threadSubject("Re: pricing")).toBe("pricing");
    expect(threadSubject("RE: FW: Fwd: pricing")).toBe("pricing");
    expect(threadSubject("AW: pricing")).toBe("pricing");
    expect(threadSubject("pricing")).toBe("pricing");
  });

  it("keeps a title that is nothing but a prefix", () => {
    expect(threadSubject("Re:")).toBe("Re:");
  });
});

describe("threadActivity", () => {
  it("folds emails on one subject into a thread where the newest sits, oldest first inside", () => {
    const items = threadActivity([
      email("c", "RE: pricing", "2026-09-22T10:00:00Z"),
      call("7", "2026-09-22T09:00:00Z"),
      email("b", "Re: Pricing", "2026-09-21T15:00:00Z"),
      email("x", "Security questionnaire", "2026-09-21T09:00:00Z"),
      email("a", "pricing", "2026-09-20T09:00:00Z"),
    ]);
    expect(items.map((item) => (item.kind === "thread" ? `thread:${item.subject}` : `${item.entry.type}:${item.entry.id}`))).toEqual([
      "thread:pricing",
      "CALL:7",
      "EMAIL:x",
    ]);
    const thread = items[0];
    if (thread?.kind !== "thread") throw new Error("expected a thread");
    expect(thread.messages.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(thread.latest.id).toBe("c");
  });

  it("leaves a lone email, and everything that is not an email, as it is", () => {
    const lone = email("x", "Re: one reply, no original", "2026-09-21T09:00:00Z");
    const items = threadActivity([call("7", "2026-09-22T09:00:00Z"), lone]);
    expect(items).toEqual([
      { kind: "entry", entry: call("7", "2026-09-22T09:00:00Z") },
      { kind: "entry", entry: lone },
    ]);
  });
});
