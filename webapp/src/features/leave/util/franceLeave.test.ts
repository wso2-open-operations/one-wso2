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
import {
  CANCEL_WINDOW_DAYS,
  COUNTED_STATUSES,
  HISTORY_STATUSES,
  REJECTION_REASON_MAX,
  canCancelLeave,
  canDownloadSickNote,
  needsLeadApproval,
  needsReason,
  needsSickNote,
  rejectionReasonProblem,
  sickNoteProblem,
  waitingFor,
} from "./franceLeave";
import type { LeaveType } from "../api/leaveTypes";

const MB = 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png"];
const file = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

describe("constants", () => {
  it("lists every status in history and counts only live ones", () => {
    expect(HISTORY_STATUSES).toEqual(["APPROVED", "PENDING", "REJECTED", "CANCELLED"]);
    expect(COUNTED_STATUSES).toEqual(["APPROVED", "PENDING"]);
    expect(REJECTION_REASON_MAX).toBe(500);
    expect(CANCEL_WINDOW_DAYS).toBe(30);
  });
});

describe("sickNoteProblem", () => {
  it("accepts a PDF up to the limit", () => {
    expect(sickNoteProblem(file("note.pdf", "application/pdf", 5 * MB), 5 * MB, TYPES)).toBe("");
  });
  it("accepts a file by extension when the MIME type is empty", () => {
    expect(sickNoteProblem(file("scan.JPG", "", 10), 5 * MB, TYPES)).toBe("");
  });
  it("refuses an empty file", () => {
    expect(sickNoteProblem(file("note.pdf", "application/pdf", 0), 5 * MB, TYPES)).toBe(
      "This file is empty.",
    );
  });
  it("refuses a file over the limit", () => {
    expect(sickNoteProblem(file("note.pdf", "application/pdf", 5 * MB + 1), 5 * MB, TYPES)).toBe(
      "This file is larger than 5.0 MB.",
    );
  });
  it("refuses other file types", () => {
    expect(sickNoteProblem(file("note.docx", "application/msword", 10), 5 * MB, TYPES)).toBe(
      "Send a PDF, JPG or PNG file.",
    );
  });
  it("trusts the reported type over the name when there is one", () => {
    expect(sickNoteProblem(file("note.pdf", "application/msword", 10), 5 * MB, TYPES)).toBe(
      "Send a PDF, JPG or PNG file.",
    );
    expect(sickNoteProblem(file("note.pdf", "", 10), 5 * MB, TYPES)).toBe("");
    expect(sickNoteProblem(file("scan.png", "image/png", 10), 5 * MB, TYPES)).toBe("");
  });
});

describe("rejectionReasonProblem", () => {
  it("needs 1 to 500 characters after trimming", () => {
    expect(rejectionReasonProblem("   ")).toBe("Enter a reason for rejecting this request.");
    expect(rejectionReasonProblem("a".repeat(500))).toBe("");
    expect(rejectionReasonProblem("a".repeat(501))).toBe(
      "The reason can be at most 500 characters.",
    );
  });
});

describe("canCancelLeave", () => {
  const today = new Date("2026-10-26T09:00:00");
  it("allows approved and pending leave within the window", () => {
    expect(canCancelLeave("APPROVED", "2026-10-01", today)).toBe(true);
    expect(canCancelLeave("PENDING", "2026-11-10", today)).toBe(true);
  });
  it("allows leave that started exactly 30 days ago", () => {
    expect(canCancelLeave("APPROVED", "2026-09-26", today)).toBe(true);
  });
  it("never offers cancel on finished leave", () => {
    expect(canCancelLeave("CANCELLED", "2026-11-10", today)).toBe(false);
    expect(canCancelLeave("REJECTED", "2026-11-10", today)).toBe(false);
    expect(canCancelLeave(null, "2026-11-10", today)).toBe(false);
  });
  it("refuses leave that started more than 30 days ago", () => {
    expect(canCancelLeave("APPROVED", "2026-09-20", today)).toBe(false);
    expect(canCancelLeave("APPROVED", "2026-09-25", today)).toBe(false);
  });
  it("always lets a pending request be withdrawn, however long ago it started", () => {
    expect(canCancelLeave("PENDING", "2026-09-16", today)).toBe(true);
    expect(canCancelLeave("APPROVED", "2026-09-16", today)).toBe(false);
  });
});

describe("needsSickNote", () => {
  it("needs a note only for sick leave in France", () => {
    expect(needsSickNote("France", "sick")).toBe(true);
    expect(needsSickNote("Spain", "sick")).toBe(false);
    expect(needsSickNote(null, "sick")).toBe(false);
    expect(needsSickNote("France", "casual")).toBe(false);
  });
});

describe("needsLeadApproval", () => {
  it("applies only to other authorized leave", () => {
    expect(needsLeadApproval("other_authorized")).toBe(true);
    const others: LeaveType[] = [
      "casual",
      "sick",
      "annual",
      "compassionate",
      "conges_payes",
      "rtt",
      "sabbatical",
    ];
    for (const type of others) expect(needsLeadApproval(type)).toBe(false);
  });
});

describe("needsReason", () => {
  it("applies only to other authorized leave", () => {
    expect(needsReason("other_authorized")).toBe(true);
    const others: LeaveType[] = ["casual", "sick", "compassionate", "conges_payes", "rtt", "sabbatical"];
    for (const type of others) expect(needsReason(type)).toBe(false);
  });
});

describe("canDownloadSickNote", () => {
  it("offers the download only until the note is deleted", () => {
    expect(canDownloadSickNote({ hasSickNote: true, sickNoteDeletedOn: null })).toBe(true);
    expect(
      canDownloadSickNote({
        hasSickNote: true,
        sickNoteDeletedOn: "2026-10-01",
      }),
    ).toBe(false);
    expect(canDownloadSickNote({ hasSickNote: false })).toBe(false);
  });
});

describe("waitingFor", () => {
  const today = new Date("2026-10-26T09:00:00");
  it("names how long a request has waited", () => {
    expect(waitingFor("2026-10-26", today)).toBe("Today");
    expect(waitingFor("2026-10-25", today)).toBe("1 day");
    expect(waitingFor("2026-10-23", today)).toBe("3 days");
  });
  it("is blank for a missing or bad date", () => {
    expect(waitingFor(null, today)).toBe("");
    expect(waitingFor("not a date", today)).toBe("");
  });
});
