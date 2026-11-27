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

// Job titles that are not in English.
//
// Salesforce keeps a job title as free text, so nothing there catches "Directeur
// Technique". The Marketing Ops backend asks Claude about each distinct title once and
// remembers the answer; this file turns those answers into findings on the grid.
//
// A flagged title is a suggestion — "Directeur Technique → Technical Director" — with
// one difference from the rest: it cannot be turned down. Every title goes to Salesforce
// in English, so the only answers are the suggestion or the RMM's own English title
// (TitleDialog). Automatic review on the server refuses a list while any title is still
// flagged.

import type { Issue, Row } from './validate'

/** The template column every member status maps "Job Title" to. */
export const TITLE_FIELD = 'job_title'

/** The finding's code, which `reject` reads to keep the title instead of dismissing. */
export const NOT_ENGLISH = 'not_english'

export interface Translation {
  english: string
  language: string | null
}

/** Trimmed, whitespace collapsed, lower-cased. Mirrors titles.key on the server — keep
 *  the two in step, or the grid and review would disagree about a title. */
export const titleKey = (title: string): string =>
  (title ?? '').split(/\s+/).filter(Boolean).join(' ').toLowerCase()

/** The finding for one cell's title, or nothing when it is English or not yet known. */
export function titleIssue(value: string,
                           translations: Record<string, Translation>): Issue | undefined {
  const key = titleKey(value)
  if (!key) return undefined
  // Own entries only: a plain object inherits "constructor", "toString" and the like, and
  // a title spelled that way must not read as a server answer.
  const found = Object.hasOwn(translations, key) ? translations[key] : undefined
  if (!found) return undefined
  const language = found.language ? `is ${found.language}` : 'isn’t in English'
  return {
    field: TITLE_FIELD,
    code: NOT_ENGLISH,
    bucket: 'fixable',
    message: `“${value.trim()}” ${language}. Use the English title, or type your own in English.`,
    value,
    suggestion: found.english,
    source: 'llm',
  }
}

/** Every distinct job title in the list, as typed — what the server is asked about. */
export function distinctTitles(tabs: Record<string, { data: Row }[]>): string[] {
  const seen = new Map<string, string>()
  for (const rows of Object.values(tabs)) {
    for (const { data } of rows) {
      const title = (data[TITLE_FIELD] ?? '').trim()
      const key = titleKey(title)
      if (key && !seen.has(key)) seen.set(key, title)
    }
  }
  return [...seen.values()]
}
