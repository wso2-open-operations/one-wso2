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

// Groups each era's known PeopleHR question labels into named categories
// (2015) or a single flat "Employee Feedback" list
// (2016/2017/2018), with the full question wording ("subtext") shown above
// each answer, and (2015's rating categories only) the raw 0-5 answer
// shown as a filled chip rather than body text. No
// `LegacyPerformanceCriteria`-style criteria box and no 2017 Q3/Q4
// "manager score as comment" special case -- neither is needed for parity
// on this main view.
import type { ParLegacyQuestionAnswer } from "../api/types";
import { isThreeSixtyConfirmation } from "./parLegacyHistory";

export type LegacyCatalogAnswerType = "rating" | "text";

export interface LegacyCatalogQuestion {
  label: string;
  subtext: string;
  // Shown only on the Employee's Feedback panel -- the question's real content is
  // exclusively the employee's own answer (2018 Q3/Q4 and 2019's single
  // "feedback on the quarter" prompt).
  employeeOnly?: boolean;
  // Shown only on the Lead's Feedback panel -- questions whose employee
  // side is always a boilerplate "N/A" (promotion/next-level questions
  // across 2017-2019, and -- explicit local request -- 2015's own
  // promotion questions, which are genuinely lead-only despite the
  // original catalog never distinguishing sides for 2015).
  leadOnly?: boolean;
  // Explicit local request: some flat-display prompts (2020's "SHARE
  // FEEDBACK..." criteria list) read as one continuous instructional
  // paragraph rather than a short question label -- italicize the label
  // too instead of the usual bold, matching that reading.
  italicLabel?: boolean;
}

export interface LegacyCatalogCategory {
  title: string;
  // A category's questions are all the same type -- rating categories show
  // a "Rating scale: 1-5" caption under the title and their answers as a
  // filled chip, text categories show plain body text. Only 2015 has
  // rating-type categories; every other era's questions are free text.
  type: LegacyCatalogAnswerType;
  questions: LegacyCatalogQuestion[];
}

const t = (label: string, subtext: string): LegacyCatalogQuestion => ({ label, subtext });
const leadOnly = (label: string, subtext: string): LegacyCatalogQuestion => ({ label, subtext, leadOnly: true });
// Every employeeOnly question in this catalog turned out to also want the
// italic-label treatment (the 2017-2019 "feedback on the quarter"-style
// prompts, same request as 2020's SHARE FEEDBACK question) -- no plain
// (non-italic) employeeOnly question exists, so there's no separate helper
// for that combination.
const employeeOnlyItalic = (label: string, subtext: string): LegacyCatalogQuestion => ({
  label,
  subtext,
  employeeOnly: true,
  italicLabel: true,
});

// ---- 2015 ANNUAL PERFORMANCE REVIEW -- category-grouped -----------------

const GENERAL_2015: LegacyCatalogCategory = {
  title: "General",
  type: "text",
  questions: [
    t("Regular Feedback", "Do you get regular feedback on work well done and areas of further improvement?"),
    t("Career Path", "Are you aware of your career path and the requirements for progression?"),
    t(
      "Adequate Assistance to help you Develop",
      "Do you feel that your are provided with adequate assistance to help you develop (training/feedback/mentoring etc)?",
    ),
    t("Next 5 years?", "What do you see yourself doing within the next 5 years?"),
    t("Additional Points to Discuss", "Are there any additional points in respect to your job which you would like to discuss?"),
  ],
};
const OVERALL_WORK_EXPERIENCE_2015: LegacyCatalogCategory = {
  title: "Overall Work Experience",
  type: "text",
  questions: [
    t("WWW", "What Went Well ?"),
    t("WCHBDB", "What Could Have Been Done Better ?"),
    // No subtext -- the real question text is pure workflow instruction
    // ("comment as N/A if not a team lead"), not useful context above the
    // answer the way every other question's subtext is. leadOnly: these
    // are genuinely answered by the lead about the employee, never shown
    // on the Employee's Feedback panel.
    leadOnly("Recommended for promotion?", ""),
    leadOnly("Proposed Designation", ""),
  ],
};
const QUALITY_DEPENDABILITY_2015: LegacyCatalogCategory = {
  title: "Quality & Dependability, Job Knowledge",
  type: "rating",
  questions: [
    t(
      "Attention to Detail",
      "Attention to Detail is a measure of work quality in terms of your ability to complete assigned tasks to the fullest extent and not leave things for others to finish.",
    ),
    t(
      "Ownership & Initiative",
      "Ownership is a measure of your responsibility and level of accountability of your work. Initiativeness is the ability to assess and initiate things independently.",
    ),
    t("Passion & Commitment", "Passion & Commitment refer to the level of dedication and energy you bring to your work."),
    t("Quality of Work", "Work Quality"),
    t("Technical Skills", "Technical Skill is a measure of your level of knowledge in the area you are engaged in."),
  ],
};
const CREATIVITY_CULTURE_2015: LegacyCatalogCategory = {
  title: "Creativity & Innovation, Culture & Values, Communication, Team Work",
  type: "rating",
  questions: [
    t("Creativity and Innovation", "Rate how well you think of new ideas and insights that help your company improve."),
    t("Culture and Values", "Rate how well you understand and practice the company's core values."),
    t("Communication", "Communication is a measure of your written, oral and interpersonal communication skills."),
    t("Team Work", "Ability to work with others in a transparent and cordial manner."),
  ],
};
const PRODUCTIVITY_2015: LegacyCatalogCategory = {
  title: "Productivity",
  type: "rating",
  questions: [
    t("Competence", "Competence is a measure of the ability to do execute your work successfully and efficiently"),
    t("Planning & Time Management", "Planning & Time Management is a measure of your ability to plan and deliver in a timely manner."),
    t("Productivity", "Reaching goals through time management, self-discipline and effective use of resources."),
  ],
};
const LEADERSHIP_2015: LegacyCatalogCategory = {
  title: "Leadership",
  type: "rating",
  questions: [
    t(
      "Delegation skills",
      "Delegation skill is the ability to effectively assign task responsibility and/or authority to others. Or, in other words, delegation skill is your ability to get things done by using work and time of other people.",
    ),
    t("Leadership", "Leadership is the measure of your ability to lead in the area of your expertise."),
    t("Working under pressure", "Working under pressure Ability to handle difficult work scenarios (timing, multi tasking etc)"),
    t("Judgment", "Judgment is a measure of your ability to make the right call."),
    t("Problem Solving & decision Making", "Multiple alternatives. Your ability to spot problems and know when to take action."),
  ],
};
const TECHNICAL_SKILLS_2015: LegacyCatalogCategory = {
  title: "Technical Skills",
  type: "rating",
  questions: [
    t("Support", "Any work done in relation to support work, including when you were in support rotation."),
    t("Customer Engagement (Applicable only to engineering team)", "Any customer engagements (onsite as well as offsite)"),
    t(
      "Marketing (Applicable only to engineering team)",
      "Any marketing activities (marketing rotation, webinars, articles, blogs, workshops, conferences, premium content etc)",
    ),
  ],
};
const TEAM_LEADERSHIP_2015: LegacyCatalogCategory = {
  title: "Team Leadership",
  type: "rating",
  questions: [
    t(
      "Engagement with your team members",
      "Your engagement with your team members in identifying their Training & Development needs and ensuring required steps are taken to facilitate same.",
    ),
    t(
      "Engagement in monitoring performance",
      "Engagement in monitoring performance and providing constructive feedback, and ability to take clear action in situations where performance issues are present.",
    ),
    t(
      "Career Management",
      "Counselling, development opportunities, communication needs, mentoring, help in identifying career goals and developing action plans.",
    ),
    t(
      "Level of Succession Planning",
      "Process for identifying and developing team members with potential to fill in managerial roles.\n(a) To take over the role as a team lead\n(b) To provide leadership in your absence",
    ),
    t(
      "How much of a WSO2 Culture champion are you?",
      "The extent you go to, in ensuring the core values, beliefs and practices of the company are adopted by your team members and others.",
    ),
    t("Your Strategic and Critical Thinking capability?", "Your ability to spot problems, finding solutions and know when to take action."),
    t(
      "Your Team building capabilities?",
      "Ability to encourage, collaborate, create an environment where everyone respects other opinions (both inter and intra team level) and conflict resolution abilities.",
    ),
    t("On the Overall Team", "On the Overall Team"),
    t("On your Personal Performance", "On your Personal Performance"),
  ],
};

export const LEGACY_2015_CATALOG: Record<string, LegacyCatalogCategory[]> = {
  "2015 ANNUAL PERFORMANCE REVIEW": [
    GENERAL_2015,
    QUALITY_DEPENDABILITY_2015,
    CREATIVITY_CULTURE_2015,
    PRODUCTIVITY_2015,
    LEADERSHIP_2015,
    OVERALL_WORK_EXPERIENCE_2015,
  ],
  "2015 ANNUAL PERFORMANCE REVIEW for Team Leads": [
    GENERAL_2015,
    QUALITY_DEPENDABILITY_2015,
    CREATIVITY_CULTURE_2015,
    PRODUCTIVITY_2015,
    LEADERSHIP_2015,
    TEAM_LEADERSHIP_2015,
    OVERALL_WORK_EXPERIENCE_2015,
  ],
  "2015 ANNUAL PERFORMANCE REVIEW for Engineering Team Leads": [
    GENERAL_2015,
    QUALITY_DEPENDABILITY_2015,
    CREATIVITY_CULTURE_2015,
    PRODUCTIVITY_2015,
    LEADERSHIP_2015,
    TECHNICAL_SKILLS_2015,
    TEAM_LEADERSHIP_2015,
    OVERALL_WORK_EXPERIENCE_2015,
  ],
  "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees": [
    GENERAL_2015,
    QUALITY_DEPENDABILITY_2015,
    CREATIVITY_CULTURE_2015,
    PRODUCTIVITY_2015,
    LEADERSHIP_2015,
    TECHNICAL_SKILLS_2015,
    OVERALL_WORK_EXPERIENCE_2015,
  ],
};

// ---- 2016 Quarterly Review -- flat (one group, 3 questions, free text) ---

const QUARTERLY_2016: LegacyCatalogQuestion[] = [
  t(
    "Job performance",
    "This is how you should review your self in terms of your core job responsibility? If you're an engineer, then that is the total cycle of work you have (R&D, support, services, consulting, marketing, pre-sales, documentation, operations).\n\nIf you're a team lead, your job performance includes the roles & responsibilities that are part of being a team leader such as mentoring, guiding, motivating, career planning, and life counselling.",
  ),
  t(
    "Communication",
    "Communication is a big part of WSO2 work environment, this is not about how many emails you send but how well you communicate about what you do and also the level of awareness of what you're doing among your immediate team and broader teams. This is also about how you are able to sell your ideas. How well do you feel you sell your ideas?",
  ),
  t(
    "Teamwork",
    "How well do you feel you operate within your immediate team and the wider WSO2 team?\n" +
      "- listening to other people's ideas\n" +
      "- constructive argumentation\n" +
      "- transparent interactions\n" +
      "- empathy (feeling other's pain)\n" +
      "- being able to receive criticism\n" +
      "- taking individual responsibility\n" +
      "- contributing to team responsibility\n" +
      "- helping each other and being considerate of others\n\n" +
      "In WSO2 you should never be in a situation where you feel you're competing with someone else in WSO2: we never limit promotions or salary revisions or performance ratings based on quotas or fitting to bell curves etc..\n\n" +
      "WSO2 is one team. All the characteristics of good teamwork must work across the entire company - there's no room to point fingers at others and pass blame.\n\n" +
      "We will succeed or fail as a team. The complexity of everything we do means we need to collaborate and work together to win.\n\n" +
      "Basically, are you being a jerk or not?",
  ),
];

export const LEGACY_2016_CATALOG: Record<string, LegacyCatalogQuestion[]> = {
  "2016 Quarterly Review - Q2": QUARTERLY_2016,
  "2016 Quarterly Review - Q3/Q4": QUARTERLY_2016,
};

// ---- 2017 Quarterly Review -- flat, one question set per quarter --------

export const LEGACY_2017_CATALOG: Record<string, LegacyCatalogQuestion[]> = {
  "2017 Quarterly Review - Q1": [
    t(
      "Any specific areas you want to discuss?",
      "Basically all you need to write here is list (or detail) down anything in particular you would like addressed in the discussions with your TL (for e.g: Career progression, plans for higher studies etc or anything else you want to talk about or address).",
    ),
    t(
      "Your feedback and observations on the quarter in review.",
      "The purpose is to get input from each of you on how we can do things better. It does not necessarily have to be directly related to your work, and could be feedback in general. This is an opportunity for you to give feedback on everything and is not related to your performance rating. This feedback will be shared with everyone anonymously at the end of the quarter.",
    ),
    leadOnly("Promotion confirmed?", ""),
    leadOnly("Revised Designation ( if recommended for promotion )", ""),
  ],
  "2017 Quarterly Review - Q2": [
    t(
      "Any specific areas you want to discuss?",
      "Basically all you need to write here is list (or detail) down anything in particular you would like addressed in the discussions with your Team Lead.",
    ),
    leadOnly("Promotion confirmed?", ""),
    leadOnly("Revised Designation ( if recommended for promotion )", ""),
  ],
  "2017 Quarterly Review - Q3": [
    leadOnly(
      "Score breakdown",
      "Employees : Type N/a\nTeam Leads :- Score breakdown for the following areas\nJob Performance (50)\nTeam Work (30)\nCommunication (20)\nExtra Credit (05)",
    ),
    t(
      "Feedback for the quarter",
      "Employees : This text box can be used to add any information /comments on your performance during the quarter. (Eg ; Key highlights, What went well, Areas for improvement etc ) . It is not mandatory.\nTeam Leads : Feedback for the quarter in review",
    ),
    leadOnly(
      "Is the employee performing at the next level?",
      "Employees - Please type N/A\nTeam Leads - Yes/No. If Yes, please give details on the stage of the next level the employee is at. If No, provide details on how they can move to the next level.",
    ),
    leadOnly("Promotion confirmed?", ""),
    leadOnly("Revised Designation ( if recommended for promotion )", ""),
  ],
  "2017 Quarterly Review - Q4": [
    leadOnly(
      "Score breakdown",
      "Employees : Type N/a\nTeam Leads :- Score breakdown for the following areas\nJob Performance (50)\nTeam Work (30)\nCommunication (20)\nExtra Credit (05)",
    ),
    t(
      "Feedback for the quarter",
      "Employees : This text box can be used to add any information /comments on your performance during the quarter. (Eg ; Key highlights, What went well, Areas for improvement etc ) . It is not mandatory.\nTeam Leads : Feedback for the quarter in review",
    ),
    leadOnly(
      "Is the employee performing at the next level?",
      "Employees - Please type N/A\nTeam Leads - Yes/No. If Yes, please give details on the stage of the next level the employee is at. If No, provide details on how they can move to the next level.",
    ),
    leadOnly("Promotion confirmed?", ""),
    leadOnly("Revised Designation ( if recommended for promotion )", ""),
  ],
};

// ---- 2018 Performance Evaluation -- Q1/Q2 grouped, Q3/Q4 flat-display ----

const Q1_Q2_2018: LegacyCatalogQuestion[] = [
  t("Your commitment to the WSO2 mission.", "Your understanding and commitment towards the company mission."),
  t("Your commitment to your team(s).", "Your commitment to your team and how it is reflected in everything you do."),
  t("Your commitment to yourself.", "Your commitment to developing yourself."),
  t("Anything else you want to discuss.", ""),
  leadOnly(
    "Is the employee performing at the next level?",
    "If Yes, please give details on the stage of the next level the employee is at. If No, provide details on how they can move to the next level.",
  ),
  leadOnly("Promotion confirmed?", ""),
  leadOnly("Revised Designation ( if recommended for promotion ).", ""),
];
const Q3_Q4_2018: LegacyCatalogQuestion[] = [
  employeeOnlyItalic(
    "Your Commitments & Your Feedback On The Quarter.",
    "This area is for you to list out your qualities which reflect your commitment to the 1) Company Mission, 2) Your Team, 3) Yourself. You may add any other discussion points/comments to this section as well.",
  ),
  leadOnly("Is the employee performing at the next level?", ""),
  leadOnly("Promotions", ""),
];

export const LEGACY_2018_CATALOG: Record<string, LegacyCatalogQuestion[]> = {
  "2018 Performance Evaluation - Q1": Q1_Q2_2018,
  "2018 Performance Evaluation - Q2": Q1_Q2_2018,
  "2018 Performance Evaluation - Q3": Q3_Q4_2018,
  "2018 Performance Evaluation - Q4": Q3_Q4_2018,
};
export const LEGACY_2018_FLAT_DISPLAY_CYCLES = new Set<string>([
  "2018 Performance Evaluation - Q3",
  "2018 Performance Evaluation - Q4",
]);

// ---- 2019 Performance Evaluation -- every quarter is flat-display -------

const LEAD_QUESTIONS_2019: LegacyCatalogQuestion[] = [
  leadOnly("Is the employee performing at the next level?", ""),
  leadOnly("Promotions", ""),
];

export const LEGACY_2019_CATALOG: Record<string, LegacyCatalogQuestion[]> = {
  "2019 Performance Evaluation - Q1": [
    employeeOnlyItalic(
      "Your Commitments & Your Feedback On The Quarter.",
      "This area is for you to list out your qualities which reflect your commitment to the 1) Company Mission, 2) Your Team, 3) Yourself. You may add any other discussion points/comments to this section as well.",
    ),
    ...LEAD_QUESTIONS_2019,
  ],
  "2019 Performance Evaluation - Q2": [
    employeeOnlyItalic(
      "Your feedback on the quarter in review.",
      "This area is for you to share feedback on your performance highlights/accomplishments, challenges faced, development needs, action items and any specific areas you want to discuss.",
    ),
    ...LEAD_QUESTIONS_2019,
  ],
  "2019 Performance Evaluation - Q3": [
    employeeOnlyItalic(
      "Your feedback on the quarter in review.",
      "This area is for you to share feedback on your performance highlights/accomplishments, challenges faced, development needs, action items and any specific areas you want to discuss.",
    ),
    ...LEAD_QUESTIONS_2019,
  ],
  "2019 Performance Evaluation - Q4": [
    employeeOnlyItalic(
      "Your feedback on the quarter in review.",
      "This area is for you to share feedback on your performance highlights/accomplishments, challenges faced, development needs, action items and any specific areas you want to discuss.",
    ),
    ...LEAD_QUESTIONS_2019,
  ],
};
export const LEGACY_2019_FLAT_DISPLAY_CYCLES = new Set<string>([
  "2019 Performance Evaluation - Q1",
  "2019 Performance Evaluation - Q2",
  "2019 Performance Evaluation - Q3",
  "2019 Performance Evaluation - Q4",
]);

// ---- 2020 Performance Evaluation -- flat, H1/H2 share one question -------
// "360 Confirmation" is deliberately NOT part of this catalog -- it's a
// workflow note (did the lead actually run the 360s), not real feedback
// prose, and is surfaced in its own separate section instead of the
// normal question list (see ParLegacyRecordDetail.tsx's own
// threeSixtyConfirmationAnswer).
const SHARE_FEEDBACK_QUESTION = employeeOnlyItalic(
  "SHARE FEEDBACK ON YOUR PERFORMANCE HIGHLIGHTS/ACCOMPLISHMENTS ON THE FOLLOWING AREAS",
  "Job Execution (Quality of work, Planning & time management, ownership & initiative, judgment & decision making)\nTeam Work (Understand roles of own and other teams, Look at issues from a team perspective, work towards achieving team goals, being a team player, working across teams, approachable)\nCommunication (clarity and accuracy in communication, participation & contribution, listening skills, empathy)\nThought Leadership/ Team Leadership",
);
const LEGACY_2020_QUESTIONS: LegacyCatalogQuestion[] = [SHARE_FEEDBACK_QUESTION];
export const LEGACY_2020_CATALOG: Record<string, LegacyCatalogQuestion[]> = {
  "2020 Performance Evaluation - H1": LEGACY_2020_QUESTIONS,
  "2020 Performance Evaluation - H2": LEGACY_2020_QUESTIONS,
};
export const LEGACY_2020_FLAT_DISPLAY_CYCLES = new Set<string>([
  "2020 Performance Evaluation - H1",
  "2020 Performance Evaluation - H2",
]);

// ---- 2021 Performance Evaluation - H1 -- same base question, plus the ----
// ---- new Top 5%/20% lead question (first cycle to capture it) -----------
const LEGACY_2021_H1_QUESTIONS: LegacyCatalogQuestion[] = [
  SHARE_FEEDBACK_QUESTION,
  leadOnly("Is the employees in the top 5% or top 20% in the team?", ""),
];
export const LEGACY_2021_CATALOG: Record<string, LegacyCatalogQuestion[]> = {
  "2021 Performance Evaluation - H1": LEGACY_2021_H1_QUESTIONS,
  "2021 Performance Evaluation - H2": [SHARE_FEEDBACK_QUESTION],
  "2022 Performance Evaluation - H1": [SHARE_FEEDBACK_QUESTION],
  "2022 Performance Evaluation - H2": [SHARE_FEEDBACK_QUESTION],
  "2023 Performance Evaluation - H1": [SHARE_FEEDBACK_QUESTION],
  "2023 Performance Evaluation - H2": [SHARE_FEEDBACK_QUESTION],
  "2024 Performance Evaluation - H1": [SHARE_FEEDBACK_QUESTION],
};
export const LEGACY_2021_FLAT_DISPLAY_CYCLES = new Set<string>([
  "2021 Performance Evaluation - H1",
  "2021 Performance Evaluation - H2",
  "2022 Performance Evaluation - H1",
  "2022 Performance Evaluation - H2",
  "2023 Performance Evaluation - H1",
  "2023 Performance Evaluation - H2",
  "2024 Performance Evaluation - H1",
]);

const normalizeLabel = (text: string | null | undefined): string => (text ?? "").trim().replace(/\s+/g, " ");

function findAnswer(label: string, questionAnswers: ParLegacyQuestionAnswer[]): ParLegacyQuestionAnswer | undefined {
  const target = normalizeLabel(label);
  return questionAnswers.find((qa) => normalizeLabel(qa.title) === target);
}

// 2015/2016 treat "N/A" as absent (never a real answer for those eras);
// 2017/2018/2019 treat it as a genuine answer (e.g. "Promotion confirmed?
// N/A" really does mean "not promoted this cycle").
function hasData(text: string | null | undefined, treatNAAsAbsent: boolean): boolean {
  if (!text || text.trim() === "") return false;
  return !(treatNAAsAbsent && text.trim().toUpperCase() === "N/A");
}

// Title of a side's non-category (flat/perQuestion) group -- 2015's
// category groups keep their own catalog titles instead.
const sideFeedbackTitle = (side: "employee" | "lead") => (side === "employee" ? "Employee Feedback" : "Lead Feedback");

export interface LegacyGroupRow {
  label: string;
  subtext: string;
  employeeAnswer: string | null;
  managerFeedback: string | null;
  italicLabel?: boolean;
}
// How a group's rows render:
//  - "category": 2015 only -- the GROUP itself is an accordion (its own
//    title, "(Rating scale from 1 to 5)" caption for rating categories),
//    with every row inside rendered as a plain labeled box, not its own
//    accordion.
//  - "perQuestion": 2016/2017/2018 Q1-Q2 -- there's no real category here
//    (the group's own title is just the generic "Performance Questions and
//    Answers" heading shown once above), so EACH ROW gets its own
//    accordion instead, titled with that question's own label (3 separate
//    "Job performance"/"Communication"/"Teamwork" accordions, not one
//    accordion wrapping all 3).
//  - "flat": 2018 Q3/Q4 and all of 2019 -- no accordion anywhere, every
//    row is a plain labeled box directly on the page.
export type LegacyGroupLayout = "category" | "perQuestion" | "flat";

export interface LegacyGroup {
  title: string;
  type: LegacyCatalogAnswerType;
  layout: LegacyGroupLayout;
  rows: LegacyGroupRow[];
}

// One dispatcher covering every catalogued era -- returns grouped sections
// for the Employee's Feedback / Lead's Feedback panels. A cycle with no
// catalog lists its recorded questions as-is (getUncataloguedQuestionGroups).
// Null when the side has no answers to show; callers render "N/A" then.
export function getLegacyQuestionGroups(
  cycleName: string,
  questionAnswers: ParLegacyQuestionAnswer[],
  side: "employee" | "lead",
): LegacyGroup[] | null {
  // employeeOnly/leadOnly hide a question's other side only when that side
  // is genuinely empty -- real migrated data does carry a lead's own answer
  // on some "employee-only" prompts (e.g. 2020+'s SHARE FEEDBACK question),
  // and that real answer must not be silently dropped.
  const showOnSide = (question: LegacyCatalogQuestion, answer: ParLegacyQuestionAnswer | undefined) =>
    side === "employee"
      ? !question.leadOnly || hasData(answer?.employeeAnswer, true)
      : !question.employeeOnly || hasData(answer?.managerFeedback, true);

  const categories = LEGACY_2015_CATALOG[cycleName];
  if (categories) {
    const groups = categories
      .map((category) => ({
        title: category.title,
        type: category.type,
        layout: "category" as const,
        rows: category.questions
          .map((question) => ({ question, answer: findAnswer(question.label, questionAnswers) }))
          .filter(({ question, answer }) => showOnSide(question, answer))
          .map(({ question, answer }) => {
            return {
              label: question.label,
              subtext: question.subtext,
              employeeAnswer: answer?.employeeAnswer ?? null,
              managerFeedback: answer?.managerFeedback ?? null,
            };
          })
          // N/A shows as a real answer for 2015 too (not hidden) -- explicit
          // request: whatever the lead/employee actually wrote, including a
          // literal "N/A", should display rather than being silently hidden.
          .filter((row) => hasData(side === "employee" ? row.employeeAnswer : row.managerFeedback, false)),
      }))
      .filter((group) => group.rows.length > 0);
    return groups.length > 0 ? groups : null;
  }

  const flatQuestions =
    LEGACY_2016_CATALOG[cycleName] ??
    LEGACY_2017_CATALOG[cycleName] ??
    LEGACY_2018_CATALOG[cycleName] ??
    LEGACY_2019_CATALOG[cycleName] ??
    LEGACY_2020_CATALOG[cycleName] ??
    LEGACY_2021_CATALOG[cycleName];
  if (!flatQuestions) {
    return getUncataloguedQuestionGroups(questionAnswers, side);
  }
  const treatNAAsAbsent = Boolean(LEGACY_2016_CATALOG[cycleName]);
  const isFlatDisplay =
    LEGACY_2018_FLAT_DISPLAY_CYCLES.has(cycleName) ||
    LEGACY_2019_FLAT_DISPLAY_CYCLES.has(cycleName) ||
    LEGACY_2020_FLAT_DISPLAY_CYCLES.has(cycleName) ||
    LEGACY_2021_FLAT_DISPLAY_CYCLES.has(cycleName);
  const rows = flatQuestions
    .map((question) => ({ question, answer: findAnswer(question.label, questionAnswers) }))
    .filter(({ question, answer }) => showOnSide(question, answer))
    .map(({ question, answer }) => {
      return {
        label: question.label,
        subtext: question.subtext,
        employeeAnswer: answer?.employeeAnswer ?? null,
        managerFeedback: answer?.managerFeedback ?? null,
        italicLabel: question.italicLabel,
      };
    })
    .filter((row) => hasData(side === "employee" ? row.employeeAnswer : row.managerFeedback, treatNAAsAbsent));
  return rows.length > 0
    ? [{ title: sideFeedbackTitle(side), type: "text", layout: isFlatDisplay ? "flat" : "perQuestion", rows }]
    : null;
}

// A cycle with no catalog still has real per-question answers on BOTH
// sides -- previously only the employee's were shown (flattened into the
// Employee Comment box) and the lead's were dropped entirely. Lists every
// recorded question as-is, in stored order. "360 Confirmation" is excluded
// here too -- it has its own dedicated section (see
// ParLegacyRecordDetail.tsx's threeSixtyConfirmationAnswer).
function getUncataloguedQuestionGroups(
  questionAnswers: ParLegacyQuestionAnswer[],
  side: "employee" | "lead",
): LegacyGroup[] | null {
  const rows = questionAnswers
    .filter((qa) => !isThreeSixtyConfirmation(qa))
    .filter((qa) => hasData(side === "employee" ? qa.employeeAnswer : qa.managerFeedback, true))
    .map((qa) => ({
      label: qa.title?.trim() || "Answer",
      subtext: "",
      employeeAnswer: qa.employeeAnswer ?? null,
      managerFeedback: qa.managerFeedback ?? null,
    }));
  return rows.length > 0 ? [{ title: sideFeedbackTitle(side), type: "text", layout: "flat", rows }] : null;
}
