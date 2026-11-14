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

import { describe, expect, it } from "vitest";
import type { AuditControl } from "@features/security/grc/modules/audit/types/audit";
import {
  deadlineHandlerLabel,
  formatDelayLogEntry,
  isCurrentDeadlineOverdue,
  isDueDateOptional,
  isMyDeadline,
  myDeadlineHandlers,
  myDeadlines,
  showMyDeadlines,
} from "./deadlines";

type Tracked = Pick<AuditControl, "id" | "deadlineTracked" | "currentHandler" | "currentDueDate">;

const control = (id: number, over: Partial<Tracked> = {}): AuditControl =>
  ({ id, deadlineTracked: true, currentHandler: "OWNER", currentDueDate: "2026-11-20", ...over }) as AuditControl;

describe("deadlineHandlerLabel", () => {
  it("names each group", () => {
    expect(deadlineHandlerLabel("OWNER")).toBe("Owner");
    expect(deadlineHandlerLabel("COMPLIANCE")).toBe("Compliance");
    expect(deadlineHandlerLabel("AUDITOR")).toBe("Auditor");
  });

  it("shows an unknown group as received", () => {
    expect(deadlineHandlerLabel("LEGAL")).toBe("LEGAL");
  });
});

describe("formatDelayLogEntry", () => {
  it("formats as the group label and MM/DD", () => {
    expect(formatDelayLogEntry({ handledBy: "OWNER", date: "2026-11-08" })).toBe("Owner - 11/08");
    expect(formatDelayLogEntry({ handledBy: "AUDITOR", date: "2027-01-02" })).toBe("Auditor - 01/02");
  });

  it("keeps the calendar day whatever the timezone (no Date round trip)", () => {
    expect(formatDelayLogEntry({ handledBy: "COMPLIANCE", date: "2026-03-01" })).toBe("Compliance - 03/01");
  });

  it("shows a malformed date as received", () => {
    expect(formatDelayLogEntry({ handledBy: "OWNER", date: "soon" })).toBe("Owner - soon");
  });
});

describe("isCurrentDeadlineOverdue", () => {
  const today = "2026-11-12";

  it("is overdue only once the date is before today", () => {
    expect(isCurrentDeadlineOverdue(control(1, { currentDueDate: "2026-11-11" }), today)).toBe(true);
    expect(isCurrentDeadlineOverdue(control(1, { currentDueDate: "2026-11-12" }), today)).toBe(false);
  });

  it("is never overdue when untracked, finished or undated", () => {
    expect(isCurrentDeadlineOverdue(control(1, { deadlineTracked: false, currentDueDate: "2020-01-01" }), today)).toBe(false);
    expect(isCurrentDeadlineOverdue(control(1, { currentHandler: null, currentDueDate: "2020-01-01" }), today)).toBe(false);
    expect(isCurrentDeadlineOverdue(control(1, { currentDueDate: null }), today)).toBe(false);
    expect(isCurrentDeadlineOverdue({} as AuditControl, today)).toBe(false);
  });
});

describe("myDeadlineHandlers / showMyDeadlines", () => {
  it("maps submitting to Owner and validating to Auditor", () => {
    expect(myDeadlineHandlers({ canSubmit: true, canValidate: false })).toEqual(["OWNER"]);
    expect(myDeadlineHandlers({ canSubmit: false, canValidate: true })).toEqual(["AUDITOR"]);
    expect(myDeadlineHandlers({ canSubmit: true, canValidate: true })).toEqual(["OWNER", "AUDITOR"]);
    expect(myDeadlineHandlers({ canSubmit: false, canValidate: false })).toEqual([]);
  });

  it("is offered to someone who holds a turn, but not to org-wide viewers", () => {
    expect(showMyDeadlines(false, { canSubmit: true, canValidate: false })).toBe(true);
    expect(showMyDeadlines(true, { canSubmit: true, canValidate: false })).toBe(false);
    expect(showMyDeadlines(false, { canSubmit: false, canValidate: false })).toBe(false);
  });
});

describe("isMyDeadline / myDeadlines", () => {
  it("matches only controls currently with the user's side", () => {
    expect(isMyDeadline(control(1), ["OWNER"])).toBe(true);
    expect(isMyDeadline(control(1, { currentHandler: "COMPLIANCE" }), ["OWNER"])).toBe(false);
    expect(isMyDeadline(control(1, { currentHandler: "AUDITOR" }), ["OWNER"])).toBe(false);
  });

  it("excludes untracked, finished and undated controls", () => {
    expect(isMyDeadline(control(1, { deadlineTracked: false }), ["OWNER"])).toBe(false);
    expect(isMyDeadline(control(1, { currentHandler: null }), ["OWNER"])).toBe(false);
    expect(isMyDeadline(control(1, { currentDueDate: null }), ["OWNER"])).toBe(false);
    expect(isMyDeadline({} as AuditControl, ["OWNER"])).toBe(false);
  });

  it("lists mine soonest first and leaves the source list alone", () => {
    const all = [
      control(1, { currentDueDate: "2026-12-01" }),
      control(2, { currentHandler: "COMPLIANCE", currentDueDate: "2026-11-01" }),
      control(3, { currentDueDate: "2026-11-05" }),
      control(4, { currentHandler: "AUDITOR", currentDueDate: "2026-11-03" }),
    ];
    expect(myDeadlines(all, ["OWNER"]).map((c) => c.id)).toEqual([3, 1]);
    expect(myDeadlines(all, ["OWNER", "AUDITOR"]).map((c) => c.id)).toEqual([4, 3, 1]);
    expect(all.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });

  it("drops a control once handed on and brings it back with its new date when rejected", () => {
    const handedOn = control(1, { currentHandler: "COMPLIANCE", currentDueDate: "2026-11-22" });
    expect(myDeadlines([handedOn], ["OWNER"])).toEqual([]);
    const rejected = control(1, { currentHandler: "OWNER", currentDueDate: "2026-12-07" });
    expect(myDeadlines([rejected], ["OWNER"]).map((c) => c.currentDueDate)).toEqual(["2026-12-07"]);
  });
});

describe("isDueDateOptional", () => {
  it("lets a new Design control leave the due date empty", () => {
    expect(isDueDateOptional(false, "DESIGN")).toBe(true);
  });

  it("still needs a due date for OE controls and when editing", () => {
    expect(isDueDateOptional(false, "OE")).toBe(false);
    expect(isDueDateOptional(true, "DESIGN")).toBe(false);
  });
});
