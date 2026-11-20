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

// TEST DATA ONLY. Seven made-up Opportunities, each showing one situation the
// screens have to handle:
//
//   Brightwater     Qualify; a Champion Proposal matched to a Contact, and no
//                 Economic Buyer heard yet (so it is an Ask next).
//   Meridian      Technical Proof; a competitor that changed between calls
//                 (Salesforce: Mulesoft -> proposed: Kong), and an Economic
//                 Buyer Proposal with no confident Contact match.
//   Nordlys       Business Proof with its Gate complete: Move stage is offered.
//   Harbourline   Validate, with two earlier Account-only calls to Include.
//   Asterra       Proposal, owned by someone else: read-only.
//   Oakridge      Gate complete, but Salesforce refuses the stage change (422).
//   Kestrel       Closed Won; hidden while "Hide closed" is on.
//
// Every name, company, quote and id here is invented. The store in
// mockStore.ts keeps these as raw Salesforce values and Proposals and derives
// every DealDetail from them, so mutations stay consistent with the circles.

import { salesforceBaseUrl } from "@config/apiConfig";
import type {
  CoverageLevel,
  DealCall,
  DealSummary,
  EvidenceQuote,
  FieldValue,
  LetterKey,
  RoleProposalValue,
  UnassignedCall,
} from "../types";

export interface MockProposal {
  value: FieldValue | RoleProposalValue;
  rationale: string | null;
  confidence: number;
  evidence: EvidenceQuote[];
  /** REJECTED: the AM turned it down; it shows no more until a call brings a new one. */
  status: "PROPOSED" | "APPROVED" | "REJECTED";
}

export interface MockCoverage {
  status: "NONE" | "PENDING" | "RUNNING" | "DONE" | "FAILED";
  coverage: Record<LetterKey, CoverageLevel> | null;
  stageAtCall: string | null;
  quotes: Partial<Record<LetterKey, EvidenceQuote[]>>;
}

export interface MockUnassigned {
  call: UnassignedCall;
  coverage: Record<LetterKey, CoverageLevel>;
  /** What including this call adds to the deal's Proposals. */
  proposals: Record<string, MockProposal>;
}

export interface MockDeal {
  summary: Omit<DealSummary, "lastCallAt" | "callCount" | "pendingCount" | "dealState">;
  hasLineItems: boolean;
  /** Keyed by Gate fieldKey. Missing = no Salesforce value. */
  salesforce: Record<string, FieldValue>;
  proposals: Record<string, MockProposal>;
  calls: DealCall[];
  unassigned: MockUnassigned[];
  productsDiscussed: string[];
  canEdit: boolean;
  /** When set, move-stage answers 422 with this Salesforce message. */
  moveRefusal?: string;
  lastApproval: { by: string; at: string } | null;
}

export interface MockFixtures {
  deals: MockDeal[];
  /** Coverage by meetingId, for the calls above. */
  coverage: Record<number, MockCoverage & { opportunityId: string | null }>;
}

// ---- helpers -----------------------------------------------------------------

type Levels = [CoverageLevel, CoverageLevel, CoverageLevel, CoverageLevel, CoverageLevel, CoverageLevel, CoverageLevel, CoverageLevel];

/** Coverage in display order: M E DC DP P I CH CO. */
function levels(values: Levels): Record<LetterKey, CoverageLevel> {
  const [M, E, DC, DP, P, I, CH, CO] = values;
  return { M, E, DC, DP, P, I, CH, CO };
}

interface CallInfo {
  meetingId: number;
  title: string;
  start: string;
  host: string;
}

function quote(call: CallInfo, speaker: string, text: string, offsetSeconds: number): EvidenceQuote {
  return {
    meetingId: call.meetingId,
    meetingTitle: call.title,
    callStart: call.start,
    speaker,
    quote: text,
    offsetSeconds,
  };
}

function proposed(
  value: FieldValue | RoleProposalValue,
  evidence: EvidenceQuote[],
  confidence = 0.8,
  rationale: string | null = null,
): MockProposal {
  return { value, rationale, confidence, evidence, status: "PROPOSED" };
}

function role(
  name: string,
  title: string | null,
  suggestedContactId: string | null,
  candidates: RoleProposalValue["candidates"],
): RoleProposalValue {
  return { name, title, suggestedContactId, candidates };
}

function dealCall(call: CallInfo, coverage: Record<LetterKey, CoverageLevel>): DealCall {
  return { ...call, coverage };
}

const AMAL = { ownerName: "Amal Perera", ownerEmail: "amal@wso2.com" };
const SOPHIE = { ownerName: "Sophie Martin", ownerEmail: "sophie@wso2.com" };
const RAVI = { ownerName: "Ravi Kumar", ownerEmail: "ravi@wso2.com" };

/** A Validate Gate someone has already filled, for the deals past it. */
function validateFilled(primary: { contactId: string; name: string }, pain: string, plays: string[]) {
  return {
    successCriteriaPain: pain,
    salesPlays: plays,
    primaryContact: primary,
  };
}

// ---- the deals -----------------------------------------------------------------

export function createFixtures(): MockFixtures {
  // Brightwater ------------------------------------------------------------------
  const k1: CallInfo = {
    meetingId: 91001,
    title: "Brightwater – discovery call",
    start: "2026-08-20T09:30:00Z",
    host: AMAL.ownerEmail,
  };
  const k2: CallInfo = {
    meetingId: 91002,
    title: "Brightwater – API Manager deep dive",
    start: "2026-09-10T10:00:00Z",
    host: AMAL.ownerEmail,
  };
  const kQuotes = {
    champion: quote(k2, "Priya Ranjan", "I'll take this to the steering committee myself — I want us off the old gateway this year.", 1312),
    process1: quote(k2, "Priya Ranjan", "Procurement will want a formal RFP, and before that we'd run a two-week POC.", 1905),
    process2: quote(k1, "Priya Ranjan", "Anything over this size goes out as an RFP.", 2240),
    criteria: quote(k2, "Suresh Menon", "Honestly it comes down to feature coverage and what it costs us over three years.", 2530),
    pain: quote(k1, "Priya Ranjan", "Every new distributor integration takes us six to eight weeks.", 410),
    metric: quote(k1, "Priya Ranjan", "If we could onboard forty partner APIs by Q2, that would be the win.", 655),
  };

  const brightwater: MockDeal = {
    summary: {
      opportunityId: "006MOCK0000BRWT",
      name: "Brightwater – API Manager first sale",
      accountId: "001MOCK0000BRWT",
      accountName: "Brightwater Pumps Limited",
      salesRegion: "EU",
      stage: "Qualify",
      recordType: "First Sale",
      amount: 120000,
      currencyIsoCode: "USD",
      closeDate: "2026-12-31",
      ...AMAL,
      isClosed: false,
    },
    hasLineItems: true,
    salesforce: {
      ...validateFilled(
        { contactId: "003MOCKK1", name: "Priya Ranjan" },
        "Success criteria: onboard 40 partner APIs by Q2 with p95 latency under 200 ms.\nPain: each distributor integration takes 6–8 weeks and blocks new distributor deals.",
        ["Unified API governance"],
      ),
      paperProcess: ["PO Required"],
      salesEngineer: "Nuwan Perera",
    },
    proposals: {
      champion: proposed(
        role("Priya Ranjan", "Director of Application Delivery", "003MOCKK1", [
          { contactId: "003MOCKK1", name: "Priya Ranjan", email: "priya.ranjan@brightwater.example", title: "Director of Application Delivery", score: 0.97 },
          { contactId: "003MOCKK3", name: "Priyanka Rao", email: "priyanka.rao@brightwater.example", title: "IT Procurement", score: 0.58 },
        ]),
        [kQuotes.champion],
        0.84,
      ),
      decisionProcess: proposed(["RFP", "POC"], [kQuotes.process1, kQuotes.process2], 0.86,
        "Both calls mention an RFP; the deep dive adds a two-week POC before it."),
      decisionCriteria: proposed(["Technical fit / feature coverage", "Total cost of ownership"], [kQuotes.criteria], 0.78),
      // Heard, and already what Salesforce says: shown as filled, never pending.
      paperProcess: proposed(["PO Required"], [quote(k2, "Suresh Menon", "Nothing moves here without a PO.", 2702)], 0.9),
      pocRequired: proposed("YES", [kQuotes.process1], 0.74),
    },
    calls: [
      dealCall(k1, levels([2, 0, 1, 2, 1, 2, 1, 0])),
      dealCall(k2, levels([1, 0, 2, 2, 1, 1, 2, 1])),
    ],
    unassigned: [],
    productsDiscussed: ["API Manager", "Micro Integrator"],
    canEdit: true,
    lastApproval: null,
  };

  // Meridian ---------------------------------------------------------------------
  const m1: CallInfo = { meetingId: 91011, title: "Meridian Bank – qualification", start: "2026-07-02T08:00:00Z", host: SOPHIE.ownerEmail };
  const m2: CallInfo = { meetingId: 91012, title: "Meridian Bank – POC kickoff", start: "2026-09-03T13:00:00Z", host: SOPHIE.ownerEmail };
  const m3: CallInfo = { meetingId: 91013, title: "Meridian Bank – architecture review", start: "2026-09-22T14:30:00Z", host: SOPHIE.ownerEmail };
  const mQuotes = {
    kong: quote(m3, "Aisha Rahman", "We've dropped MuleSoft from the shortlist. Kong is the other one we're comparing you with now.", 1488),
    kong2: quote(m2, "Tomás Ortega", "Kong's team is running the same POC scenarios next week.", 3021),
    aws: quote(m3, "Tomás Ortega", "Everything lands in our AWS landing zone, eu-west-1.", 812),
    k8s: quote(m3, "Tomás Ortega", "EKS is on the roadmap for next quarter, we're not there yet.", 905),
    fit: quote(m2, "Aisha Rahman", "The mediation and the rate limiting cover what we need for the payments APIs.", 2210),
    cfo: quote(m3, "Aisha Rahman", "Grace, our CFO, signs off anything above a quarter million now — it moved away from Daniel.", 2766),
  };

  const meridian: MockDeal = {
    summary: {
      opportunityId: "006MOCK0000MERI",
      name: "Meridian Bank – integration platform",
      accountId: "001MOCK0000MERI",
      accountName: "Meridian Bank Group",
      salesRegion: "EU",
      stage: "Technical Proof",
      recordType: "First Sale",
      amount: 340000,
      currencyIsoCode: "EUR",
      closeDate: "2027-02-28",
      ...SOPHIE,
      isClosed: false,
    },
    hasLineItems: true,
    salesforce: {
      ...validateFilled(
        { contactId: "003MOCKM1", name: "Aisha Rahman" },
        "Success criteria: expose 120 payment APIs to partners with PSD2-grade security.\nPain: the in-house gateway can't meet the regulator's audit requirements.",
        ["Mulesoft migration", "Competitive displacement"],
      ),
      economicBuyer: { contactId: "003MOCKM2", name: "Daniel Ong" },
      champion: { contactId: "003MOCKM1", name: "Aisha Rahman" },
      decisionProcess: ["RFP", "Validation by Evaluation and/or buying Committee", "Security Review Required"],
      paperProcess: ["PO Required", "Mandatory Legal Review"],
      decisionCriteria: ["Security & compliance certs", "Scalability & performance"],
      salesEngineer: "Kasun Silva",
      pocRequired: "YES",
      competitors: ["Mulesoft"],
      infrastructure: ["Cloud"],
    },
    proposals: {
      competitors: proposed(["Kong"], [mQuotes.kong, mQuotes.kong2], 0.88,
        "The 22 Sep architecture review says MuleSoft was dropped; Kong is now the alternative, as the POC kickoff already hinted."),
      cloudProvider: proposed(["AWS"], [mQuotes.aws], 0.92),
      kubernetes: proposed("In the pipeline", [mQuotes.k8s], 0.81),
      useCaseFit: proposed("YES", [mQuotes.fit], 0.72),
      // A later call contradicts Salesforce, and no Contact is a confident match.
      economicBuyer: proposed(
        role("Grace Lim", "CFO", null, [
          { contactId: "003MOCKM4", name: "Grace Lim-Tan", email: "grace.limtan@meridian.example", title: "Chief Financial Officer", score: 0.74 },
          { contactId: "003MOCKM5", name: "G. Lim", email: "g.lim@meridian.example", title: "Finance Analyst", score: 0.66 },
          { contactId: "003MOCKM2", name: "Daniel Ong", email: "daniel.ong@meridian.example", title: "Head of Digital Channels", score: 0.12 },
        ]),
        [mQuotes.cfo],
        0.7,
      ),
    },
    calls: [
      dealCall(m1, levels([2, 2, 2, 2, 2, 2, 2, 1])),
      dealCall(m2, levels([1, 0, 2, 1, 0, 1, 1, 2])),
      dealCall(m3, levels([0, 2, 2, 0, 0, 0, 1, 2])),
    ],
    unassigned: [],
    productsDiscussed: ["API Manager", "Choreo", "Micro Integrator"],
    canEdit: true,
    lastApproval: { by: "sophie@wso2.com", at: "2026-07-05T09:12:00Z" },
  };

  // Nordlys: Gate complete --------------------------------------------------------
  const n1: CallInfo = { meetingId: 91021, title: "Nordlys Energi – business case", start: "2026-09-01T07:00:00Z", host: RAVI.ownerEmail };
  const n2: CallInfo = { meetingId: 91022, title: "Nordlys Energi – budget sign-off", start: "2026-09-24T07:30:00Z", host: RAVI.ownerEmail };

  const nordlys: MockDeal = {
    summary: {
      opportunityId: "006MOCK0000NORD",
      name: "Nordlys Energi – identity expansion",
      accountId: "001MOCK0000NORD",
      accountName: "Nordlys Energi AS",
      salesRegion: "EU",
      stage: "Business Proof",
      recordType: "Expansion",
      amount: 95000,
      currencyIsoCode: "USD",
      closeDate: "2026-11-15",
      ...RAVI,
      isClosed: false,
    },
    hasLineItems: true,
    salesforce: {
      ...validateFilled(
        { contactId: "003MOCKN1", name: "Ingrid Solberg" },
        "Success criteria: single sign-on for 12,000 field workers by March.\nPain: three identity stores and a help desk drowning in password resets.",
        ["IAM federation"],
      ),
      economicBuyer: { contactId: "003MOCKN2", name: "Lars Haugen" },
      champion: { contactId: "003MOCKN1", name: "Ingrid Solberg" },
      decisionProcess: ["Direct Award"],
      paperProcess: ["WSO2 Invoice"],
      decisionCriteria: ["Total cost of ownership", "Vendor stability & support"],
      salesEngineer: "Dilini Fernando",
      pocRequired: "NO",
      useCaseFit: "YES",
      competitors: ["Okta"],
      infrastructure: ["Self-hosted"],
      kubernetes: "YES",
      budgetConfirmed: "YES",
      proposalRequested: "YES",
    },
    proposals: {
      // The next Gate's work, already heard: becomes current once the stage moves.
      procurementLegal: proposed(
        role("Kari Nilsen", "Procurement Manager", "003MOCKN3", [
          { contactId: "003MOCKN3", name: "Kari Nilsen", email: "kari.nilsen@nordlys.example", title: "Procurement Manager", score: 0.95 },
        ]),
        [quote(n2, "Lars Haugen", "Kari Nilsen from procurement will run the paperwork from here.", 1710)],
        0.83,
      ),
    },
    calls: [
      dealCall(n1, levels([2, 1, 1, 1, 0, 2, 1, 1])),
      dealCall(n2, levels([2, 2, 0, 1, 2, 1, 1, 0])),
    ],
    unassigned: [],
    productsDiscussed: ["Identity Server", "Asgardeo"],
    canEdit: true,
    lastApproval: { by: "ravi@wso2.com", at: "2026-09-24T10:02:00Z" },
  };

  // Harbourline: unassigned calls -----------------------------------------------
  const h1: CallInfo = { meetingId: 91031, title: "Harbourline – intro call", start: "2026-09-18T15:00:00Z", host: AMAL.ownerEmail };
  const h2: CallInfo = { meetingId: 91032, title: "Harbourline Logistics – account catch-up", start: "2026-08-12T15:00:00Z", host: AMAL.ownerEmail };
  const h3: CallInfo = { meetingId: 91033, title: "Harbourline – integration roadmap", start: "2026-08-26T16:00:00Z", host: AMAL.ownerEmail };

  const harbourline: MockDeal = {
    summary: {
      opportunityId: "006MOCK0000HARB",
      name: "Harbourline – API platform",
      accountId: "001MOCK0000HARB",
      accountName: "Harbourline Logistics",
      salesRegion: "APAC",
      stage: "Validate",
      recordType: "First Sale",
      amount: 60000,
      currencyIsoCode: "GBP",
      closeDate: "2027-03-31",
      ...AMAL,
      isClosed: false,
    },
    hasLineItems: false,
    salesforce: {},
    proposals: {
      successCriteriaPain: proposed(
        "Success criteria: track every container event through one API within 2 seconds.\nPain: 14 point-to-point integrations that break with every carrier change.",
        [
          quote(h1, "Chen Wei", "We have fourteen point-to-point integrations and every carrier change breaks one.", 520),
          quote(h1, "Chen Wei", "Getting a container event to the customer in under two seconds, that's the target.", 780),
        ],
        0.82,
      ),
      salesPlays: proposed(["Mulesoft migration"], [quote(h1, "Chen Wei", "The MuleSoft renewal is the forcing function, honestly.", 1204)], 0.77),
    },
    calls: [dealCall(h1, levels([2, 0, 0, 0, 0, 2, 0, 1]))],
    unassigned: [
      {
        call: { ...h2, letters: ["M", "I", "CH"] },
        coverage: levels([1, 0, 0, 0, 0, 1, 2, 0]),
        proposals: {
          primaryContact: proposed(
            role("Chen Wei", "Head of Integration", "003MOCKH1", [
              { contactId: "003MOCKH1", name: "Chen Wei", email: "chen.wei@harbourline.example", title: "Head of Integration", score: 0.98 },
              { contactId: "003MOCKH2", name: "Wei Zhang", email: "wei.zhang@harbourline.example", title: "Developer", score: 0.51 },
            ]),
            [quote(h2, "Chen Wei", "Just come to me directly on anything integration-related.", 1330)],
            0.8,
          ),
        },
      },
      {
        call: { ...h3, letters: ["DC", "CO"] },
        coverage: levels([0, 0, 1, 0, 0, 0, 0, 2]),
        proposals: {
          competitors: proposed(["Mulesoft"], [quote(h3, "Chen Wei", "We'd be comparing you against staying on MuleSoft.", 2045)], 0.75),
        },
      },
    ],
    productsDiscussed: ["API Manager"],
    canEdit: true,
    lastApproval: null,
  };

  // Asterra: read-only ------------------------------------------------------------
  const a1: CallInfo = { meetingId: 91041, title: "Asterra Health – proposal walkthrough", start: "2026-09-15T12:00:00Z", host: SOPHIE.ownerEmail };

  const asterra: MockDeal = {
    summary: {
      opportunityId: "006MOCK0000ASTE",
      name: "Asterra Health – FHIR gateway",
      accountId: "001MOCK0000ASTE",
      accountName: "Asterra Health Network",
      salesRegion: "NA",
      stage: "Proposal",
      recordType: "First Sale",
      amount: 210000,
      currencyIsoCode: "USD",
      closeDate: "2026-10-31",
      ...SOPHIE,
      isClosed: false,
    },
    hasLineItems: true,
    salesforce: {
      ...validateFilled(
        { contactId: "003MOCKA1", name: "Dr. Helen Ward" },
        "Success criteria: FHIR APIs live for 30 clinics before the interoperability deadline.\nPain: manual record exchange delays referrals by days.",
        ["API & AI Revenue Acceleration"],
      ),
      economicBuyer: { contactId: "003MOCKA2", name: "Robert Chen" },
      champion: { contactId: "003MOCKA1", name: "Dr. Helen Ward" },
      decisionProcess: ["Public Tender"],
      paperProcess: ["Customer Portal", "Mandatory Legal Review"],
      decisionCriteria: ["Security & compliance certs"],
      salesEngineer: "Kasun Silva",
      pocRequired: "YES",
      pocCompleted: "YES",
      useCaseFit: "YES",
      competitors: ["APIgee"],
      infrastructure: ["Hybrid"],
      kubernetes: "YES",
      budgetConfirmed: "YES",
      proposalRequested: "YES",
    },
    proposals: {
      procurementLegal: proposed(
        role("Mark Ellison", "Procurement Lead", "003MOCKA3", [
          { contactId: "003MOCKA3", name: "Mark Ellison", email: "mark.ellison@asterra.example", title: "Procurement Lead", score: 0.99 },
        ]),
        [quote(a1, "Robert Chen", "Mark Ellison owns the contract from our side.", 940)],
        0.87,
      ),
      wso2Selected: proposed("YES", [quote(a1, "Robert Chen", "The committee picked WSO2 on Friday, so let's get the paperwork going.", 215)], 0.93),
    },
    calls: [dealCall(a1, levels([1, 2, 1, 1, 2, 0, 1, 2]))],
    unassigned: [],
    productsDiscussed: ["API Manager", "Healthcare Accelerator"],
    canEdit: false,
    lastApproval: { by: "sophie@wso2.com", at: "2026-09-02T08:40:00Z" },
  };

  // Oakridge: Salesforce refuses the move -------------------------------------------
  const o1: CallInfo = { meetingId: 91061, title: "Oakridge University – technical close-out", start: "2026-09-19T09:00:00Z", host: RAVI.ownerEmail };

  const oakridge: MockDeal = {
    summary: {
      opportunityId: "006MOCK0000OAKR",
      name: "Oakridge University – campus IAM",
      accountId: "001MOCK0000OAKR",
      accountName: "Oakridge University",
      salesRegion: "NA",
      stage: "Technical Proof",
      recordType: "First Sale",
      amount: 48000,
      currencyIsoCode: "AUD",
      closeDate: "2026-12-12",
      ...RAVI,
      isClosed: false,
    },
    hasLineItems: true,
    salesforce: {
      ...validateFilled(
        { contactId: "003MOCKO1", name: "Prof. Alan Hughes" },
        "Success criteria: one login for 40,000 students by next semester.\nPain: four identity systems after the campus merger.",
        ["IAM federation", "Vendor Consolidation"],
      ),
      economicBuyer: { contactId: "003MOCKO2", name: "Jenny Park" },
      champion: { contactId: "003MOCKO1", name: "Prof. Alan Hughes" },
      decisionProcess: ["RFQ"],
      paperProcess: ["PO Required"],
      decisionCriteria: ["Open source / licensing model"],
      salesEngineer: "Dilini Fernando",
      pocRequired: "YES",
      pocCompleted: "YES",
      useCaseFit: "YES",
      competitors: ["Okta", "Forgerock"],
      infrastructure: ["Cloud"],
      cloudProvider: ["Azure"],
      kubernetes: "No",
    },
    proposals: {},
    calls: [dealCall(o1, levels([1, 1, 2, 1, 0, 1, 1, 2]))],
    unassigned: [],
    productsDiscussed: ["Asgardeo"],
    canEdit: true,
    moveRefusal:
      "FIELD_CUSTOM_VALIDATION_EXCEPTION: Stage can only be advanced through the Update MEDDPICC Stages flow.",
    lastApproval: { by: "ravi@wso2.com", at: "2026-09-20T03:15:00Z" },
  };

  // Kestrel: closed ---------------------------------------------------------------
  const c1: CallInfo = { meetingId: 91051, title: "Kestrel Telecom – signing call", start: "2026-06-30T10:00:00Z", host: SOPHIE.ownerEmail };

  const kestrel: MockDeal = {
    summary: {
      opportunityId: "006MOCK0000KEST",
      name: "Kestrel Telecom – API Manager expansion",
      accountId: "001MOCK0000KEST",
      accountName: "Kestrel Telecom",
      salesRegion: "APAC",
      stage: "Closed Won",
      recordType: "Expansion",
      amount: 180000,
      currencyIsoCode: "USD",
      closeDate: "2026-06-30",
      ...SOPHIE,
      isClosed: true,
    },
    hasLineItems: true,
    salesforce: {
      ...validateFilled(
        { contactId: "003MOCKC1", name: "Omar Haddad" },
        "Success criteria: monetise 25 network APIs.\nPain: no way to bill partners for API usage.",
        ["API & AI Revenue Acceleration"],
      ),
      economicBuyer: { contactId: "003MOCKC2", name: "Nadia Farouk" },
      champion: { contactId: "003MOCKC1", name: "Omar Haddad" },
      decisionProcess: ["Direct Award"],
      paperProcess: ["PO Required"],
      decisionCriteria: ["Total cost of ownership"],
      salesEngineer: "Nuwan Perera",
      pocRequired: "NO",
      useCaseFit: "YES",
      competitors: ["Kong"],
      infrastructure: ["Self-hosted"],
      kubernetes: "YES",
      budgetConfirmed: "YES",
      proposalRequested: "YES",
      procurementLegal: { contactId: "003MOCKC3", name: "Yusuf Demir" },
      wso2Selected: "YES",
      csOnboarding: true,
      contractAdded: true,
      wonReasons: ["Existing WSO2 footprint", "TCO advantage"],
      eulaVersion: "2025-03",
      autoRenewal: "Yes",
    },
    proposals: {},
    calls: [dealCall(c1, levels([2, 2, 1, 1, 2, 1, 1, 1]))],
    unassigned: [],
    productsDiscussed: ["API Manager"],
    canEdit: true,
    lastApproval: { by: "sophie@wso2.com", at: "2026-06-30T12:00:00Z" },
  };

  const deals = [brightwater, meridian, nordlys, harbourline, asterra, oakridge, kestrel];

  // Coverage for every call above, with up to two hover quotes per Letter.
  const coverage: MockFixtures["coverage"] = {};
  for (const deal of deals) {
    for (const call of deal.calls) {
      coverage[call.meetingId] = {
        status: "DONE",
        coverage: call.coverage,
        stageAtCall: deal.summary.stage,
        quotes: {},
        opportunityId: deal.summary.opportunityId,
      };
    }
    for (const { call, coverage: levels } of deal.unassigned) {
      coverage[call.meetingId] = {
        status: "DONE",
        coverage: levels,
        stageAtCall: null,
        quotes: {},
        opportunityId: null,
      };
    }
  }
  coverage[91001].quotes = { M: [kQuotes.metric], I: [kQuotes.pain], DP: [kQuotes.process2] };
  coverage[91002].quotes = { CH: [kQuotes.champion], DP: [kQuotes.process1], DC: [kQuotes.criteria] };
  coverage[91012].quotes = { CO: [mQuotes.kong2], DC: [mQuotes.fit] };
  coverage[91013].quotes = { CO: [mQuotes.kong], E: [mQuotes.cfo], DC: [mQuotes.aws, mQuotes.k8s] };
  coverage[91031].quotes = {
    I: [quote(h1, "Chen Wei", "We have fourteen point-to-point integrations and every carrier change breaks one.", 520)],
  };

  return { deals, coverage };
}

/**
 * Where "Open in Salesforce" points in the test data: the contract's
 * `SALESFORCE_BASE_URL + "/" + opportunityId`, on this app's own Salesforce host.
 * The ids are invented, so the record will not exist.
 */
export function mockSalesforceUrl(opportunityId: string): string {
  return `${salesforceBaseUrl}/${opportunityId}`;
}
