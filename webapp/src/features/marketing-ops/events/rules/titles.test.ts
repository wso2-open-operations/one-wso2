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

// Job titles not in English: flagged with an English suggestion, and flagged until the
// title is replaced with the suggestion or the RMM's own English title.

import { describe, expect, it } from "vitest";
import type { FieldDef } from "../eventsTypes";
import {
  accept,
  answerTitle,
  applyTranslations,
  countsFor,
  edit,
  fromPayload,
  pendingTitles,
  reject,
  rejectedCount,
  toPayload,
  type Model,
  type Payload,
} from "./model";
import type { Reference } from "./reference";
import type { EventsConfig } from "./schema";
import { NOT_ENGLISH, distinctTitles, titleIssue, titleKey } from "./titles";

function def(field_name: string, extra: Partial<FieldDef> = {}): FieldDef {
  return { field_name, header_label: field_name, data_type: "text", picklist: [], mandatory: false, ...extra };
}
const config: EventsConfig = {
  statuses: [{ name: "Booth", score: 5, enabled: true }],
  fields: { Booth: [def("Email", { mandatory: true }), def("Job Title")] },
};
const ref: Reference = { countries: [], states: {}, stateRequired: [], assisted: false };
const event = { name: "DSI Forum", date: "2026-11-20", campaignUrl: "" };

const ANSWERS = [{ key: "directeur technique", english: "Technical Director", language: "French" }];

function load(titles: string[]): Model {
  const rows = titles.map((job_title, i) => ({ email: `p${i}@x.io`, job_title }));
  return applyTranslations(fromPayload({ tabs: { Booth: rows } }, event, ref, config), ANSWERS, ref, config);
}
const cell = (m: Model, i: number) => ({ tab: "Booth", rowId: m.tabs.Booth[i].id, field: "job_title" });
const titleIssues = (m: Model) => m.tabs.Booth.map((r) => r.issues.find((i) => i.code === NOT_ENGLISH));

describe("titleKey", () => {
  it("mirrors the server's key", () => {
    expect(titleKey("  Directeur   Technique ")).toBe("directeur technique");
    expect(titleKey("")).toBe("");
  });
});

describe("distinctTitles", () => {
  it("asks about each title once, as typed, and skips blanks", () => {
    const m = load(["CTO", "Directeur Technique", " directeur  technique", "", "CTO"]);
    expect(distinctTitles(m.tabs)).toEqual(["CTO", "Directeur Technique"]);
  });
});

describe("a title not in English", () => {
  it("is a suggestion on every row with that title, and blocks like one", () => {
    const m = load(["CTO", "Directeur Technique", "directeur technique"]);
    const [cto, a, b] = titleIssues(m);
    expect(cto).toBeUndefined();
    expect(a).toMatchObject({
      suggestion: "Technical Director",
      bucket: "fixable",
      source: "llm",
      message: "“Directeur Technique” is French. Use the English title, or type your own in English.",
    });
    expect(b?.suggestion).toBe("Technical Director");
    expect(countsFor(m.tabs.Booth)).toMatchObject({ total: 2, fixable: 2 });
  });

  it("is accepted on every row with that title at once", () => {
    const base = load(["Directeur Technique", "CTO", " directeur  technique"]);
    const done = accept(base, [cell(base, 0)], ref, config);
    expect(done.tabs.Booth.map((r) => r.data.job_title)).toEqual(["Technical Director", "CTO", "Technical Director"]);
    expect(titleIssues(done)).toEqual([undefined, undefined, undefined]);
  });

  it("can't be rejected — it stays flagged, with its English still offered", () => {
    const base = load(["Directeur Technique", "directeur technique"]);
    const after = reject(base, [cell(base, 0), cell(base, 1)], ref, config);
    expect(titleIssues(after).map((i) => i?.suggestion)).toEqual(["Technical Director", "Technical Director"]);
    expect(after.dismissed.size).toBe(0);
    expect(rejectedCount(after)).toBe(0);
  });

  it("is not settled by a kept_titles list saved before keeping was removed", () => {
    const rows = [{ email: "p@x.io", job_title: "Directeur Technique" }];
    const old = { tabs: { Booth: rows }, kept_titles: ["directeur technique"] } as Payload;
    const m = applyTranslations(fromPayload(old, event, ref, config), ANSWERS, ref, config);
    expect(titleIssues(m)[0]?.suggestion).toBe("Technical Director");
    expect(toPayload(m)).not.toHaveProperty("kept_titles");
  });

  it("goes away when the title is edited", () => {
    const base = load(["Directeur Technique"]);
    const edited = edit(base, "Booth", [{ rowId: base.tabs.Booth[0].id, field: "job_title", value: "CTO" }], ref, config);
    expect(titleIssues(edited)).toEqual([undefined]);
  });
});

describe("the title dialog", () => {
  const ANSWERS2 = [...ANSWERS, { key: "jefe de ventas", english: "Head of Sales", language: "Spanish" }];
  const loadTwo = (titles: string[]) => applyTranslations(load(titles), ANSWERS2, ref, config);

  it("asks once per distinct title, with how many rows it covers", () => {
    const m = loadTwo(["Directeur Technique", "Jefe de Ventas", "directeur technique", "CTO"]);
    expect(pendingTitles(m)).toEqual([
      { key: "directeur technique", title: "Directeur Technique", english: "Technical Director", language: "French", rows: 2 },
      { key: "jefe de ventas", title: "Jefe de Ventas", english: "Head of Sales", language: "Spanish", rows: 1 },
    ]);
  });

  it("uses the English on every row, and moves on to the next title", () => {
    const m = answerTitle(loadTwo(["Directeur Technique", "Jefe de Ventas", "directeur technique"]),
      "directeur technique", "Technical Director", ref, config);
    expect(m.tabs.Booth.map((r) => r.data.job_title)).toEqual(["Technical Director", "Jefe de Ventas", "Technical Director"]);
    expect(pendingTitles(m).map((p) => p.key)).toEqual(["jefe de ventas"]);
  });

  it("takes your own title in place of the suggestion", () => {
    const m = answerTitle(load(["Directeur Technique", "directeur technique"]), "directeur technique", " CTO ", ref, config);
    expect(m.tabs.Booth.map((r) => r.data.job_title)).toEqual(["CTO", "CTO"]);
    expect(pendingTitles(m)).toEqual([]);
  });

  it("refuses the same title typed back, or nothing at all", () => {
    const base = load(["Directeur Technique"]);
    expect(answerTitle(base, "directeur technique", "DIRECTEUR  technique", ref, config)).toBe(base);
    expect(answerTitle(base, "directeur technique", "  ", ref, config)).toBe(base);
    expect(pendingTitles(base)).toHaveLength(1);
  });
});

describe("titleIssue", () => {
  it("reads only the server's own answers, not what every object inherits", () => {
    expect(titleIssue("Constructor", {})).toBeUndefined();
    expect(titleIssue("toString", {})).toBeUndefined();
    const own = { constructor: { english: "Builder", language: "Spanish" } };
    expect(titleIssue("Constructor", own)?.code).toBe(NOT_ENGLISH);
  });
});
