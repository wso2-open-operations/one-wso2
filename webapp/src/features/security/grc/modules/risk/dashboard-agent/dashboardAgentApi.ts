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

import { BACKEND_BASE_URL } from "@features/security/grc/shim/apiConfig";

type AuthFetch = (input: RequestInfo | URL, options?: RequestInit) => Promise<Response>;

// The dashboard agent turns a sentence into a widget. The backend does the
// thinking and all the access control: this file only carries requests and
// answers. Nothing here names a table, a column or a permission.

export interface WidgetFilter {
  field: string;
  op: string;
  values: string[];
}

export interface WidgetSpec {
  dataset: string;
  measures: string[];
  dimensions: string[];
  // What a list shows (one row per risk); counts use measures and dimensions.
  columns?: string[];
  filters: WidgetFilter[];
  sort?: { by: string; desc: boolean };
  limit: number;
}

export type WidgetVisual = "kpi" | "bar" | "heatmap" | "table";

export interface Widget {
  title: string;
  visual: WidgetVisual;
  spec: WidgetSpec;
}

export interface Starter {
  id: string;
  title: string;
  description: string;
  widget: Widget;
}

export interface ResultColumn {
  id: string;
  role: "dimension" | "measure" | "column";
  kind: string;
  label: string;
}

export type Cell = string | number | null;

export interface WidgetResult {
  columns: ResultColumn[];
  rows: Cell[][];
  truncated: boolean;
  // A sentence written by the backend from the numbers, with no model involved.
  summary?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

// RiskLink points at one risk. The id is the same one the register's own address
// uses; the register itself decides whether the user may open it.
export interface RiskLink {
  id: number;
  code: string;
  // Set when the entry is a control: the audit it is in (id is then the control's id).
  audit_id?: number;
}

// ControlLinkRef points at one control, to offer to open it.
export interface ControlLinkRef {
  audit_id: number;
  control_id: number;
  code: string;
}

export interface TimelineEvent {
  date: string;
  text: string;
}

// A risk's history, oldest first.
export interface Timeline {
  note?: string;
  events: TimelineEvent[];
}

export interface CompareRow {
  label: string;
  values: string[];
  differs: boolean;
}

// Two risks side by side: risks[i] heads the column of values[i] in each row.
export interface CompareTable {
  risks: RiskLink[];
  rows: CompareRow[];
}

// ControlTarget is a control the user asked to be taken to.
export interface ControlTarget {
  audit_id: number;
  control_id: number;
}

export type InterpretResult =
  | {
      action: "reply";
      message: string;
      risk_link?: RiskLink;
      control_link?: ControlLinkRef;
      timeline?: Timeline;
      compare?: CompareTable;
      navigate?: ControlTarget;
    }
  | { action: "widget"; widget: Widget; note?: string }
  | { action: "clarify"; question: string }
  | { action: "unsupported"; message: string };

// Which hub's assistant the popup talks to. Each hub has its own endpoints, so
// each assistant can only reach its own data.
export type AssistantHub = "risk" | "audit";

const assistantBase = (hub: AssistantHub): string =>
  `${BACKEND_BASE_URL}/api/v1/${hub === "audit" ? "audits" : "risks"}/dashboard-agent`;

// Limits the backend enforces, mirrored so the popup can stop early.
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_HISTORY_TURNS = 6;

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

// fetchStarters is how the launcher learns whether the assistant exists for this
// user. The backend answers 404 when it is switched off or the user may not use
// it (including external auditors), so any failure here means "do not show it".
// The ready-made views it returns are not shown to anyone: the assistant builds
// one only when the user asks for it by name.
export async function fetchStarters(authFetch: AuthFetch, hub: AssistantHub = "risk"): Promise<Starter[] | null> {
  try {
    const res = await authFetch(`${assistantBase(hub)}/starters`);
    if (!res.ok) return null;
    const body = (await res.json()) as { starters?: Starter[] };
    return body.starters ?? null;
  } catch {
    return null;
  }
}

export async function interpretWidget(
  authFetch: AuthFetch,
  body: { message: string; history: ChatTurn[]; current?: Widget },
  hub: AssistantHub = "risk",
): Promise<InterpretResult> {
  const res = await authFetch(`${assistantBase(hub)}/interpret`, {
    method: "POST",
    body: JSON.stringify({ message: body.message, history: body.history, current: body.current ?? null }),
  });
  return readJson<InterpretResult>(res);
}

export async function runWidget(authFetch: AuthFetch, spec: WidgetSpec, hub: AssistantHub = "risk"): Promise<WidgetResult> {
  const res = await authFetch(`${assistantBase(hub)}/query`, {
    method: "POST",
    body: JSON.stringify(spec),
  });
  return readJson<WidgetResult>(res);
}
