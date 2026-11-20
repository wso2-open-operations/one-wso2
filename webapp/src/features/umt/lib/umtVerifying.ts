// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

// Public PRs — asked for on the view page and when an update moves from
// Released to Completed — live in WSO2's public GitHub organizations, wso2
// and wso2-extensions.
const PUBLIC_PR_REGEX = /^https:\/\/github\.com\/(wso2|wso2-extensions)\/[A-Za-z0-9._-]+\/pull\/[0-9]+$/;

export function umtPublicPrError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || PUBLIC_PR_REGEX.test(trimmed)) return undefined;
  return "The public PR must be a link like https://github.com/wso2/<repo>/pull/<number> or https://github.com/wso2-extensions/<repo>/pull/<number>.";
}

// Mirrors CompleteUpdateForm.tsx's exact exclusive-or rule: at least one
// non-blank public pull request, or a non-blank reason to skip one — never
// both, and never neither. A malformed non-blank entry fails validation
// outright rather than being silently excluded from the count: folding it into
// "no pull request provided" would let it slip through alongside a reason,
// which the exclusive-or rule is meant to forbid, and would let it ride along
// in the submitted list unvalidated.
//
// `publicPullRequests` are the ones entered now and must each be a wso2 public
// PR. `existingPullRequests` were saved earlier — possibly before that rule —
// so they count towards having a PR but aren't re-checked: a stored link the
// dialog can't edit must not block completion for good.
export function isCompleteUpdateValid(input: {
  existingPullRequests?: string[];
  publicPullRequests: string[];
  reason: string;
}): boolean {
  const nonBlankPullRequests = input.publicPullRequests.map((pr) => pr.trim()).filter((pr) => pr !== "");
  if (nonBlankPullRequests.some((pr) => umtPublicPrError(pr))) return false;

  const existingCount = (input.existingPullRequests ?? []).filter((pr) => pr.trim() !== "").length;
  const hasPullRequest = nonBlankPullRequests.length + existingCount > 0;
  const hasReason = input.reason.trim() !== "";

  return hasPullRequest !== hasReason;
}
