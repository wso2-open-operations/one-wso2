// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

export interface UmtIssueLink {
  href: string;
  label: string;
}

const GITHUB_ISSUE_PATH = /^https:\/\/github\.com\/[^/]+\/([^/]+)\/issues\/(\d+)\/?$/i;

// How an update's GitHub issue field shows: a link to the issue, labelled
// "repository#number" when it is a GitHub issue address. Null when the field
// holds no web address (empty, the "N/A" kept for an issue that does not
// apply, or any other text), so the caller shows the value as plain text
// instead of a link.
export function umtIssueLink(value: string | null | undefined): UmtIssueLink | null {
  const href = (value ?? "").trim();
  if (!/^https:\/\//i.test(href)) return null;
  const [, repository, issueNumber] = href.match(GITHUB_ISSUE_PATH) ?? [];
  return { href, label: repository ? `${repository}#${issueNumber}` : href };
}
