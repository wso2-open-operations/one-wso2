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

import type { FormAnswers, FormDefinition, FormQuestion, FormSection } from "../api/leadership360Types";

/** Sections shown above the steps (the template marks them `display: "HEADER"`). */
export function headerSections(definition: FormDefinition): FormSection[] {
  return definition.sections.filter((s) => s.display === "HEADER");
}

/** Sections shown one per step, in template order. */
export function stepSections(definition: FormDefinition): FormSection[] {
  return definition.sections.filter((s) => s.display !== "HEADER");
}

export function isAnswered(value: FormAnswers[string] | undefined): boolean {
  if (value === null || value === undefined) return false;
  return typeof value === "string" ? value.trim() !== "" : true;
}

export function allQuestions(definition: FormDefinition): FormQuestion[] {
  return definition.sections.flatMap((s) => s.questions);
}

/** Required questions without an answer, in template order. */
export function missingRequired(definition: FormDefinition, answers: FormAnswers): FormQuestion[] {
  return allQuestions(definition).filter((q) => q.required && !isAnswered(answers[q.id]));
}

/** How many of a section's rated questions are answered, for the step labels. */
export function sectionProgress(section: FormSection, answers: FormAnswers): { answered: number; total: number } {
  const rated = section.questions.filter((q) => q.type === "RATING");
  return { answered: rated.filter((q) => isAnswered(answers[q.id])).length, total: rated.length };
}

/** Answers with empty strings and nulls removed — what gets sent to the backend. */
export function cleanAnswers(answers: FormAnswers): FormAnswers {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => isAnswered(value)));
}
