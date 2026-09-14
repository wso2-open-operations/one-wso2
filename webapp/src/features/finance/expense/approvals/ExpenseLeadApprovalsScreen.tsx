/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import ExpenseApprovalsScreen from "./ExpenseApprovalsScreen";

/**
 * Expense Claims → Lead Approvals — the first of a claim's two review stages.
 *
 * Thin on purpose. The source app does the same thing: one `Approvals`
 * component parameterised by view, mounted twice under two sidebar entries and
 * two URLs (`routes.tsx:15-21`). This page names the stage; everything the
 * screen does with it — the title, the `leadEmail` scoping, the tab statuses,
 * the rejection reason, the absent print button — already lives in the screen.
 *
 * Copying the table, filters, review pane and dialog into a second set would
 * mean every fix and every review comment applied twice, and the two stages
 * drifting apart over time. Drift between them IS the disparity this migration
 * exists to avoid.
 *
 * What differs at this stage, all decided inside the screen:
 *  - the queue is scoped to claims routed to this lead (`leadEmail`)
 *  - approving passes the claim ON to finance rather than finishing it
 *  - rejecting asks for a reason, and refuses to send an empty one — this is
 *    the only stage whose reason the backend can store
 *  - there is no print button; the source offers it to finance alone
 */
export default function ExpenseLeadApprovalsScreen() {
  return <ExpenseApprovalsScreen stage="LEAD" />;
}
