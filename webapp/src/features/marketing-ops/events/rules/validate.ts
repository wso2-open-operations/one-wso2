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

// Is each attendee row good enough to import? Plus the fields MOP computes.
//
// Most of this is driven by the column definitions an admin edits: whether a value is
// required, a pattern it must match, and which values a pick list allows. Only a handful
// of rules stay in code, and each is here because a per-column setting cannot express
// it — see SPECIAL in schema.ts.
//
// **A missing value and a wrong value are different problems.** Wrong is FIXABLE —
// there is something to work from. Missing is NEEDS_YOU — nothing can invent an email
// that was never captured. That split is what makes the grid honest, and it is the same
// line the suggestion layer draws: a model can fix format, it cannot invent facts.
//
// It runs in the browser: pure string comparison over a few hundred rows, so a network
// round trip in front of every keystroke bought nothing and cost the feel of the screen.

import {
  COMPUTED_FIELDS, OPT_IN_IMPORTABLE, OPT_IN_STATUS_VALUES, SPECIAL,
  defsOf, labelOf, scoreOf, slug,
  type EventsConfig, type Field, type Tab,
} from './schema'
import { baseColumns } from './columns'
import type { Reference } from './reference'

export type Bucket = 'fixable' | 'needs_you'

export interface Issue {
  field: Field
  code: string
  bucket: Bucket
  message: string
  value: string
  /** What we think it should be. Absent means the user has to decide. */
  suggestion?: string
  source?: 'reference' | 'alias' | 'fuzzy' | 'llm'
  /** The allowed set, when there is one to choose from. */
  options?: string[]
  /** The fact that disambiguates this cell — for a state, the country. Carried
   *  explicitly rather than parsed back out of the message. */
  context?: string
}

export type Row = Record<string, string>

// Spellings that turn up constantly and are not worth a model call.
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States', us: 'United States', u_s_a: 'United States',
  united_states_of_america: 'United States', america: 'United States',
  uk: 'United Kingdom', u_k: 'United Kingdom', great_britain: 'United Kingdom',
  britain: 'United Kingdom', england: 'United Kingdom',
  uae: 'United Arab Emirates', holland: 'Netherlands',
  south_korea: 'Korea, Republic of', russia: 'Russian Federation',
  vietnam: 'Viet Nam', turkey: 'Türkiye',
}

const get = (row: Row, f: Field) => (row[f] ?? '').trim()

/** Resolve a value against an allowed set, tolerating case and punctuation. Returns the
 *  canonical spelling, or undefined if it genuinely is not in the set. */
function lookup(value: string, allowed: readonly string[]): string | undefined {
  if (!value) return undefined
  const target = slug(value)
  return allowed.find(c => slug(c) === target)
}

/** Compiled patterns, cached by source.
 *
 *  A pattern is checked against every value of a column on every revalidation, and
 *  revalidation runs on each keystroke's commit. Recompiling a regex per cell was pure
 *  waste. An invalid one is stored as null rather than throwing: Settings refuses to
 *  save one, but a row already in the database must not take the whole grid down. */
const compiled = new Map<string, RegExp | null>()
function regexFor(pattern: string): RegExp | null {
  if (!compiled.has(pattern)) {
    try { compiled.set(pattern, new RegExp(pattern)) } catch { compiled.set(pattern, null) }
  }
  return compiled.get(pattern) ?? null
}

// ---- derived values ---------------------------------------------------------------------------

export interface EventContext {
  name: string
  date: string          // ISO yyyy-mm-dd
  /** The Salesforce campaign URL given when the submission was started. */
  campaignUrl?: string | null
}

// A Salesforce campaign ID: the 701 key prefix, 12 more characters, and optionally the
// three-character case-safe suffix. Found anywhere in the text, so a Lightning URL, a
// Classic URL and a bare pasted ID all work. The Marketing Ops backend
// (ONE_WSO2_MARKETINGOPS_BACKEND_URL) applies the same rule when it builds the CSV, so
// a change here has to be made there too.
const CAMPAIGN_ID = /(?<![A-Za-z0-9])(701[A-Za-z0-9]{12})([A-Za-z0-9]{3})?(?![A-Za-z0-9])/
const SUFFIX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'

/** Salesforce's case-safe 18-character form of a 15-character ID. The short form is
 *  case-sensitive and the CSV passes through Excel, whose lookups are not. */
function to18(id15: string): string {
  let suffix = ''
  for (let start = 0; start < 15; start += 5) {
    let bits = 0
    for (let i = 0; i < 5; i++) {
      const c = id15[start + i]
      if (c >= 'A' && c <= 'Z') bits |= 1 << i
    }
    suffix += SUFFIX_ALPHABET[bits]
  }
  return id15 + suffix
}

/** The 18-character campaign ID in a Salesforce campaign URL, or '' when there is none. */
export function campaignIdFrom(url: string | null | undefined): string {
  const m = CAMPAIGN_ID.exec(url ?? '')
  if (!m) return ''
  return m[2] ? m[1] + m[2] : to18(m[1])
}

/** `<campaign name>, <year>` — e.g. "Exito BFSI Summit Philippines, 2026".
 *
 *  A loose convention rather than a format: the stated rule was campaign + month +
 *  year, but a real value carries no month. */
export function optInMethod(event: EventContext): string {
  const name = (event.name ?? '').trim()
  const year = (event.date ?? '').slice(0, 4)
  return year ? `${name}, ${year}` : name
}

/** Recompute the fields MOP owns. Returns a new row; the caller decides whether to keep
 *  it. Applied on load and after any change to the event, so a corrected date flows
 *  through every row without a re-upload. */
export function derive(row: Row, tab: Tab, event: EventContext, config: EventsConfig): Row {
  const next = { ...row }
  next.score = String(scoreOf(config, tab))
  const method = optInMethod(event)
  if (method) next.opt_in_method = method
  if (event.date) next.opt_in_timestamp = event.date
  // One answer for the whole submission, stamped on every row because the Pardot import
  // is a flat file with nowhere else to carry it. Always set, even to '', so a URL that
  // was cleared does not leave the old ID behind.
  next.campaign_id = campaignIdFrom(event.campaignUrl)
  return next
}

export function deriveAll(rows: Row[], tab: Tab, event: EventContext,
                          config: EventsConfig): Row[] {
  return rows.map(r => derive(r, tab, event, config))
}

/** Which computed cells this row would change — used only to tell the user what we set,
 *  never to ask them to approve it. */
export function derivedChanges(row: Row, tab: Tab, event: EventContext,
                               config: EventsConfig): Field[] {
  const after = derive(row, tab, event, config)
  return COMPUTED_FIELDS.filter(f => (row[f] ?? '') !== (after[f] ?? ''))
}

// ---- validation ---------------------------------------------------------------------------

export function validateRow(row: Row, tab: Tab, ref: Reference, config: EventsConfig): Issue[] {
  const out: Issue[] = []
  const issue = (i: Issue) => out.push(i)
  const present = new Set(baseColumns(config, tab))
  const has = (f: Field) => present.has(f)
  const label = (f: Field) => labelOf(config, tab, f)

  // --- what the definitions say ------------------------------------------------------
  for (const def of defsOf(config, tab)) {
    // A computed column has no rule to check: MOP supplies the value, so there is
    // nothing a user could have got wrong and nothing for them to fix.
    if (def.computed) continue
    const f = slug(def.field_name)
    const value = get(row, f)

    if (!value) {
      // Absence is only a problem where an admin said it is, and nothing can be guessed
      // here, so it is always the user's to answer.
      if (def.mandatory) {
        issue({ field: f, code: 'required', bucket: 'needs_you', value: '',
                message: `${def.field_name} is required.` })
      }
      continue
    }

    if (def.data_type === 'picklist' && def.picklist.length) {
      // Consent is not a formatting problem — handled below, never auto-corrected.
      if (f === SPECIAL.optInStatus) continue
      const canonical = lookup(value, def.picklist)
      if (canonical !== value) {
        issue({ field: f, code: 'not_in_picklist', bucket: 'fixable', value,
                suggestion: canonical, source: canonical ? 'reference' : undefined,
                options: def.picklist,
                message: `“${value}” isn’t one of the allowed values for ${def.field_name}.` })
      }
      continue
    }

    if (def.data_type === 'text' && def.pattern) {
      const re = regexFor(def.pattern)
      // A pattern that will not compile is ignored rather than failing every row. It
      // cannot be saved through Settings, so this only guards data already stored.
      if (re && !re.test(value)) {
        // Never repaired: the pattern says what is acceptable, not what was meant.
        // A column that holds an email address says so in plain words; any other names
        // the column, since "isn't a valid assign to user" reads as nonsense. Told by what
        // the pattern accepts, not by its text: a social handle's pattern has "@" in it
        // too, but doesn't accept an address.
        const holdsEmail = f === SPECIAL.email || re.test('someone@example.com')
        issue({ field: f, code: 'pattern_mismatch', bucket: 'needs_you', value,
                message: holdsEmail
                  ? `“${value}” isn’t a valid email address.`
                  : `“${value}” isn’t in the format ${def.field_name} needs.` })
      }
    }
  }

  // --- email, beyond the configured pattern --------------------------------------------
  //
  // The pattern an admin configures is deliberately loose, and two real-world forms pass
  // it: a trailing dot ("a@b.com.") and a pasted "mailto:" link. Both bounce. This is the
  // same check the server makes at submit — keep the two in step, or the server refuses
  // lists the grid calls clean.
  if (has(SPECIAL.email)) {
    const email = get(row, SPECIAL.email)
    if (email && !EMAIL_RE.test(email) && !out.some(i => i.field === SPECIAL.email)) {
      issue({ field: SPECIAL.email, code: 'pattern_mismatch', bucket: 'needs_you', value: email,
              message: `“${email}” isn’t a valid email address.` })
    }
  }

  // --- country and state ---------------------------------------------------------------
  //
  // Reference-driven rather than pick lists: there are 241 countries, and which states
  // are allowed depends on the row's country. A flat list per column cannot say that.
  let canonicalCountry: string | undefined
  if (has(SPECIAL.country)) {
    const country = get(row, SPECIAL.country)
    if (country) {
      canonicalCountry = lookup(country, ref.countries)
      if (!canonicalCountry) {
        const alias = COUNTRY_ALIASES[slug(country)]
        canonicalCountry = ref.countries.includes(alias) ? alias : undefined
        issue({ field: SPECIAL.country, code: 'unknown_country', bucket: 'fixable',
                value: country, suggestion: canonicalCountry,
                source: canonicalCountry ? 'alias' : undefined, options: ref.countries,
                message: `“${country}” isn’t a country we recognise.` })
      } else if (canonicalCountry !== country) {
        issue({ field: SPECIAL.country, code: 'unknown_country', bucket: 'fixable',
                value: country, suggestion: canonicalCountry, source: 'reference',
                options: ref.countries,
                message: `“${country}” isn’t spelled the way we hold it.` })
      }
    }
  }

  if (has(SPECIAL.state)) {
    const state = get(row, SPECIAL.state)
    const needsState = !!canonicalCountry && ref.stateRequired.includes(canonicalCountry)
    const allowed = canonicalCountry ? (ref.states[canonicalCountry] ?? []) : []

    if (needsState && !state) {
      issue({ field: SPECIAL.state, code: 'state_required', bucket: 'needs_you', value: '',
              options: allowed, context: `country is ${canonicalCountry}`,
              message: `${label(SPECIAL.state)} is required for ${canonicalCountry}.` })
    } else if (state && allowed.length) {
      const canonicalState = lookup(state, allowed)
      if (!canonicalState) {
        // Ambiguous abbreviations ("TN" is Tennessee in the US and Tamil Nadu in India)
        // are exactly what the model is for; leave the suggestion empty.
        issue({ field: SPECIAL.state, code: 'unknown_state', bucket: 'fixable', value: state,
                options: allowed, context: `country is ${canonicalCountry}`,
                message: `“${state}” isn’t one of Salesforce’s states for ${canonicalCountry}.` })
      } else if (canonicalState !== state) {
        issue({ field: SPECIAL.state, code: 'unknown_state', bucket: 'fixable', value: state,
                suggestion: canonicalState, source: 'reference', options: allowed,
                context: `country is ${canonicalCountry}`,
                message: `“${state}” isn’t spelled the way we hold it.` })
      }
    }
  }

  // --- consent ---------------------------------------------------------------------------
  //
  // Held apart from the other pick lists because none of the usual moves apply. There is
  // no suggestion, not even for a plain miscasing: "confirmed" → "Confirmed" reads like a
  // spelling fix, but the thing being asserted is that a person consented, and that is
  // for someone to affirm rather than for us to tidy. Every path here is `needs_you`.
  if (has(SPECIAL.optInStatus)) {
    const raw = get(row, SPECIAL.optInStatus)
    const canonical = lookup(raw, OPT_IN_STATUS_VALUES)
    if (!raw) {
      // Absence is the mandatory rule's business, above.
    } else if (!canonical) {
      issue({ field: SPECIAL.optInStatus, code: 'opt_in_unknown', bucket: 'needs_you',
              value: raw, options: OPT_IN_STATUS_VALUES,
              message: `Opt-in status must be “Confirmed” or “Pending” — “${raw}” is neither.` })
    } else if (canonical !== OPT_IN_IMPORTABLE) {
      issue({ field: SPECIAL.optInStatus, code: 'opt_in_pending', bucket: 'needs_you',
              value: raw, options: OPT_IN_STATUS_VALUES,
              message: 'This lead hasn’t confirmed opt-in yet, so it can’t be imported. '
                     + 'Set it to “Confirmed” once they have, or remove the row.' })
    } else if (canonical !== raw) {
      issue({ field: SPECIAL.optInStatus, code: 'opt_in_unknown', bucket: 'needs_you',
              value: raw, options: OPT_IN_STATUS_VALUES,
              message: `“${raw}” isn’t written the way we hold it — pick the value from the list.` })
    }
  }

  // --- a hot lead has to say why -----------------------------------------------------------
  // A cross-column rule: no per-column setting can express "required, but only when
  // another column says 1".
  if (has(SPECIAL.hotLead) && has(SPECIAL.notes)
      && get(row, SPECIAL.hotLead) === '1' && !get(row, SPECIAL.notes)) {
    issue({ field: SPECIAL.notes, code: 'notes_required_for_hot_lead', bucket: 'needs_you',
            value: '', message: `${label(SPECIAL.notes)} are required for a hot lead.` })
  }

  return out
}

/** A usable email address: no spaces, quotes, brackets, colons or commas anywhere, and a
 *  domain of dot-separated parts with nothing empty — so no trailing dot and no
 *  "mailto:". The same pattern the server checks at submit; keep the two in step. */
export const EMAIL_RE = /^[^@\s:<>,;"()[\]]+@[^@\s.,;:<>"()[\]]+(\.[^@\s.,;:<>"()[\]]+)+$/

export function validateRows(rows: Row[], tab: Tab, ref: Reference,
                             config: EventsConfig): Issue[][] {
  const issues = rows.map(r => validateRow(r, tab, ref, config))

  // The same person twice in one member status is the same prospect imported twice —
  // a cross-row rule, so it lives here rather than in validateRow. Said in the grid, so
  // it is fixed alongside everything else instead of surfacing only at Review. The server
  // refuses the same thing at review; both ignore case and surrounding spaces.
  const first = new Map<string, number>()
  rows.forEach((r, i) => {
    const email = get(r, SPECIAL.email).toLowerCase()
    if (!email) return
    const seen = first.get(email)
    if (seen === undefined) {
      first.set(email, i)
    } else {
      issues[i].push({ field: SPECIAL.email, code: 'duplicate', bucket: 'needs_you', value: get(r, SPECIAL.email),
                       message: `Same email as row ${seen + 1}.` })
    }
  })
  return issues
}
