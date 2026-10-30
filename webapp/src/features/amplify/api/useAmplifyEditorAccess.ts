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

import { describeError } from "@api/errors";
import { AMPLIFY_DASHBOARD_ITEM_IDS, AMPLIFY_EDITOR_ITEM_IDS } from "@constants/perspectives";
import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import type { AmplifyGrant, AmplifyMe } from "./amplifyTypes";
import { isAmplifyBackendConfigured, useAmplifyMe } from "./useAmplifyData";

export interface AmplifyAccess {
  hasAccess: boolean;
  isResolving: boolean;
  error?: string;
  retry: () => void;
}

export type AmplifyEditorAccess = AmplifyAccess;
export type AmplifyDashboardAccess = AmplifyAccess;

/** Whether GET /me granted the caller `grant`. No answer yet is no grant. */
export function hasAmplifyGrant(me: AmplifyMe | undefined, grant: AmplifyGrant): boolean {
  return Boolean(me?.grants?.includes(grant));
}

/**
 * Whether amplify-api grants the caller `grant` (GET /me `grants`, ADR-038).
 * Which Asgardeo groups hold a grant is amplify-api configuration, so the UI
 * names no group: the same pattern as the Marketing Ops gate.
 *
 * Presentation only. amplify-api checks the grant again on every call and 403s
 * anyone without it. `enabled` keeps it quiet off the Amplify perspective, and
 * while it isn't enabled (or amplify-api isn't configured) it answers "no
 * access" rather than "resolving", so it never holds a landing it has nothing
 * to say about. Fails closed while /me is in flight.
 */
export function useAmplifyGrant(grant: AmplifyGrant, enabled = true): AmplifyAccess {
  const me = useAmplifyMe(enabled);
  const retry = () => void me.refetch();
  // No amplify-api URL: /me never runs, so its query would stay pending forever.
  if (!enabled || !isAmplifyBackendConfigured()) return { hasAccess: false, isResolving: false, retry };
  return {
    hasAccess: hasAmplifyGrant(me.data, grant),
    // `isPending`, so the window before the Asgardeo sub resolves counts as resolving too.
    isResolving: me.isPending,
    // describeError never surfaces the raw response body — see @api/errors.
    error: me.isError ? describeError(me.error) : undefined,
    retry,
  };
}

/** New Post and Current Posts: `CAN_CAMPAIGN`, the grant amplify-api checks on POST/PATCH/DELETE /campaigns. */
export function useAmplifyEditorAccess(enabled = true): AmplifyEditorAccess {
  return useAmplifyGrant("CAN_CAMPAIGN", enabled);
}

/** The Dashboarding boards and the person popup: `CAN_DASHBOARD`, the grant on GET /dashboards/*. */
export function useAmplifyDashboardAccess(enabled = true): AmplifyDashboardAccess {
  return useAmplifyGrant("CAN_DASHBOARD", enabled);
}

/**
 * The left-menu answer for Amplify's New Post and Current Posts rows. Hidden
 * while resolving (fails closed) and when /me fails; the route guard is where a
 * failure is explained.
 */
export function amplifyEditorVisibility(gate: AmplifyEditorAccess): VisibilityAnswer {
  return {
    canSee: (id) => AMPLIFY_EDITOR_ITEM_IDS.has(id) && gate.hasAccess && !gate.isResolving,
    resolving: gate.isResolving,
    retry: gate.retry,
  };
}

/**
 * The left-menu answer for Amplify's grant-gated rows: New Post and Current
 * Posts for `CAN_CAMPAIGN`, the Dashboarding boards for `CAN_DASHBOARD`.
 */
export function amplifyVisibility(editor: AmplifyEditorAccess, dashboards: AmplifyDashboardAccess): VisibilityAnswer {
  const resolving = editor.isResolving || dashboards.isResolving;
  return {
    canSee: (id) =>
      (AMPLIFY_EDITOR_ITEM_IDS.has(id) && editor.hasAccess && !editor.isResolving) ||
      (AMPLIFY_DASHBOARD_ITEM_IDS.has(id) && dashboards.hasAccess && !dashboards.isResolving),
    resolving,
    retry: editor.retry,
  };
}
