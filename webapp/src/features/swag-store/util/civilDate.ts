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

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A civil date from the backend ("2026-12-12") as a short day and month. It is
 * read and formatted in UTC, so the day never moves with the viewer's timezone.
 * Undefined for anything that isn't a real date.
 */
export function formatCivilDate(value: string, locale?: string): string | undefined {
  const match = CIVIL_DATE.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (instant.getUTCMonth() !== month - 1 || instant.getUTCDate() !== day) return undefined;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(instant);
}
