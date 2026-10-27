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
import type { FormDefinition } from "../api/leadership360Types";
import { cleanAnswers, headerSections, missingRequired, sectionProgress, stepSections } from "./leadership360Form";

const definition: FormDefinition = {
  kind: "LEADERSHIP_360",
  version: 1,
  title: "Leadership 360° feedback",
  scales: { agreement: { min: 1, max: 5 } },
  sections: [
    {
      id: "relationship",
      title: "How you work with them",
      display: "HEADER",
      questions: [{ id: "relationship", type: "CHOICE", text: "How?", required: true, options: [] }],
    },
    {
      id: "traits",
      title: "Personal traits",
      questions: [
        { id: "integrity", type: "RATING", scale: "agreement", text: "Shows integrity", required: true },
        { id: "ownership", type: "RATING", scale: "agreement", text: "Takes ownership", required: false },
      ],
    },
    {
      id: "other",
      title: "Other feedback",
      questions: [{ id: "other", type: "TEXT", text: "Anything else?", required: false }],
    },
  ],
};

describe("leadership360Form", () => {
  it("splits header sections from steps", () => {
    expect(headerSections(definition).map((s) => s.id)).toEqual(["relationship"]);
    expect(stepSections(definition).map((s) => s.id)).toEqual(["traits", "other"]);
  });

  it("lists unanswered required questions in template order, ignoring blank text", () => {
    expect(missingRequired(definition, {}).map((q) => q.id)).toEqual(["relationship", "integrity"]);
    expect(missingRequired(definition, { relationship: "  ", integrity: 3 }).map((q) => q.id)).toEqual([
      "relationship",
    ]);
    expect(missingRequired(definition, { relationship: "DIRECT_LEAD", integrity: 3 })).toEqual([]);
  });

  it("counts answered rated questions per section", () => {
    expect(sectionProgress(definition.sections[1], { integrity: 4 })).toEqual({ answered: 1, total: 2 });
    expect(sectionProgress(definition.sections[2], { other: "Hi" })).toEqual({ answered: 0, total: 0 });
  });

  it("drops blank answers before sending", () => {
    expect(cleanAnswers({ integrity: 4, other: " ", ownership: null })).toEqual({ integrity: 4 });
  });
});
