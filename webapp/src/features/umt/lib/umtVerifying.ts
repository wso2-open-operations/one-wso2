// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

// Each public pull request is validated as any valid URL, not specifically a
// GitHub PR link like PR Analysis's GITHUB_PR_REGEX, so this is a plain URL
// check, not a reuse of that regex.
export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Mirrors CompleteUpdateForm.tsx's exact exclusive-or rule: at least one
// non-blank, valid-URL public pull request, or a non-blank reason to skip
// one — never both, and never neither. A malformed non-blank entry fails
// validation outright rather than being silently excluded from the count:
// folding it into "no pull request provided" would let it slip through
// alongside a reason, which the exclusive-or rule is meant to forbid, and
// would let it ride along in the submitted list unvalidated.
export function isCompleteUpdateValid(input: {
  publicPullRequests: string[];
  reason: string;
}): boolean {
  const nonBlankPullRequests = input.publicPullRequests.map((pr) => pr.trim()).filter((pr) => pr !== "");
  if (nonBlankPullRequests.some((pr) => !isValidHttpUrl(pr))) return false;

  const hasPullRequest = nonBlankPullRequests.length > 0;
  const hasReason = input.reason.trim() !== "";

  return hasPullRequest !== hasReason;
}
