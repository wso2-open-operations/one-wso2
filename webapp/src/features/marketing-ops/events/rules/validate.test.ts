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

// Email checks beyond the configured pattern, and duplicates flagged in the grid — the
// cases the DSI edge-case files showed slipping through.

import { describe, expect, it } from "vitest";
import type { FieldDef } from "../eventsTypes";
import type { Reference } from "./reference";
import type { EventsConfig } from "./schema";
import { EMAIL_RE, validateRows, type Row } from "./validate";

const LOOSE_EMAIL = "^[^@\\s]+@[^@\\s.]+\\.[^@\\s]+$"; // the pattern Settings holds today
function def(field_name: string, extra: Partial<FieldDef> = {}): FieldDef {
  return { field_name, header_label: field_name, data_type: "text", picklist: [], mandatory: false, ...extra };
}
const config: EventsConfig = {
  statuses: [{ name: "Booth", score: 5, enabled: true }],
  fields: {
    Booth: [
      def("Email", { mandatory: true, pattern: LOOSE_EMAIL }),
      def("Assign to User", { pattern: LOOSE_EMAIL }),
      def("Badge", { pattern: "^B-\\d+$" }),
      def("Social handle", { pattern: "^@[a-z]+$" }),
    ],
  },
};
const ref: Reference = { countries: [], states: {}, stateRequired: [], assisted: false };

const messages = (rows: Row[]) => validateRows(rows, "Booth", ref, config).map((issues) => issues.map((i) => i.message));

describe("email", () => {
  it.each([
    "amine@medina-telecom.example.",
    "mailto:amine@medina-telecom.example",
    "amine@@medina-telecom.example",
    "amine@localhost",
    "Amine <amine@medina-telecom.example>",
    "amine@medina-telecom..example",
    'amine@medina"telecom.example',
    "amine@(medina).example",
    "amine@medina-telecom.ex[ample]",
  ])("refuses %s", (email) => {
    expect(EMAIL_RE.test(email)).toBe(false);
    expect(messages([{ email }])[0]).toEqual([`“${email}” isn’t a valid email address.`]);
  });

  it.each(["ines+events@sahel-assur.example", "NOUR.SASSI@ATLASBANQUE.EXAMPLE", "a@mail.co.uk", "o'neil@x.io"])(
    "accepts %s",
    (email) => {
      expect(EMAIL_RE.test(email)).toBe(true);
      expect(messages([{ email }])[0]).toEqual([]);
    },
  );

  it("words a pattern failure by what the column holds", () => {
    expect(
      messages([{ email: "a@x.io", assign_to_user: "Riadh B.", badge: "1000", social_handle: "wso2" }])[0],
    ).toEqual([
      "“Riadh B.” isn’t a valid email address.",
      "“1000” isn’t in the format Badge needs.",
      // An "@" in the pattern doesn't make it an email column.
      "“wso2” isn’t in the format Social handle needs.",
    ]);
  });
});

describe("duplicates", () => {
  it("flags every repeat of an email after the first, ignoring case and spaces", () => {
    const out = messages([{ email: "a@x.io" }, { email: "b@x.io" }, { email: " A@X.IO " }, { email: "a@x.io" }]);
    expect(out).toEqual([[], [], ["Same email as row 1."], ["Same email as row 1."]]);
  });
});

describe("states", () => {
  // Any country Salesforce keeps a state list for is checked, not only the three where a
  // state is required — the lists come from Salesforce, which refuses anything else.
  const withState: EventsConfig = {
    ...config,
    fields: { Booth: [def("Email"), def("Country"), def("State")] },
  };
  const italy: Reference = { countries: ["Italy"], states: { Italy: ["Milan", "Rome"] }, stateRequired: [], assisted: false };
  const check = (state: string) =>
    validateRows([{ email: "a@x.io", country: "Italy", state }], "Booth", italy, withState)[0].map((i) => i.message);

  it("accepts a state on the list and refuses one that isn't", () => {
    expect(check("Milan")).toEqual([]);
    expect(check("Lombardy")).toEqual(["“Lombardy” isn’t one of Salesforce’s states for Italy."]);
  });
});
