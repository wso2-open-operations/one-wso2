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

// Shapes of the PAR backend's Leadership 360° endpoints (modules/types/forms.bal).

export type FormQuestionType = "RATING" | "TEXT" | "CHOICE";

export interface FormScale {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  allowNotObserved?: boolean;
}

export interface FormChoiceOption {
  value: string;
  label: string;
}

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  text: string;
  required?: boolean;
  scale?: string;
  options?: FormChoiceOption[];
  maxLength?: number;
  // Reported only in aggregate, never per response.
  aggregateOnly?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  hint?: string;
  // "HEADER" renders the section above the steps instead of as a step.
  display?: string;
  questions: FormQuestion[];
}

export interface FormDefinition {
  kind: string;
  version: number;
  title: string;
  scales: Record<string, FormScale>;
  sections: FormSection[];
}

export interface FormTemplate {
  formTemplateId: number;
  formKind: string;
  formVersion: number;
  definition: FormDefinition;
}

// Answers keyed by question id: a rating number or a text/choice string.
export type FormAnswers = Record<string, number | string | null>;

export type Leadership360SurveyStatus = "UPCOMING" | "OPEN" | "CLOSED";

export interface Leadership360Survey {
  surveyId: number;
  surveyName: string;
  formTemplateId: number;
  startDate: string;
  endDate: string;
  status: Leadership360SurveyStatus;
}

export interface Leadership360SurveyInput {
  surveyName: string;
  startDate: string;
  endDate: string;
}

export interface Leadership360CurrentSurvey {
  survey: Leadership360Survey;
  template: FormTemplate;
}

export interface Leadership360Leader {
  workEmail: string;
  employeeName: string;
  jobRole: string | null;
  employeeThumbnail: string | null;
}

export interface Leadership360FeedbackInput {
  leaderEmail: string;
  answers: FormAnswers;
  anonymous: boolean;
}

export type Leadership360Draft = Leadership360FeedbackInput;

export interface Leadership360MyFeedback {
  drafts: Leadership360Draft[];
  submittedLeaderEmails: string[];
}

export interface FormQuestionAverage {
  questionId: string;
  average: number;
  ratingCount: number;
}

export interface Leadership360NamedResponse {
  respondentEmail: string;
  answers: FormAnswers;
}

export interface Leadership360Summary {
  leaderEmail: string;
  // While the survey is open, PAR admins only.
  responseCount?: number;
  available: boolean;
  reason?: string;
  overallAverage?: number;
  questionAverages: FormQuestionAverage[];
  comments: string[];
  // PAR admins only.
  relationshipCounts?: Record<string, number>;
  // PAR admins and the leader's manager only.
  namedResponses?: Leadership360NamedResponse[];
}

export interface Leadership360ResultsEntry {
  leader: Leadership360Leader;
  // While the survey is open, PAR admins only.
  responseCount?: number;
  available: boolean;
}

// Which screen reads results, which sets the role the backend answers in:
// your own (Me), the leaders who report to you (Lead View), or every leader
// (Admin View, PAR admins only).
export type Leadership360View = "SELF" | "REPORTS" | "ALL";
