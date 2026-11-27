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

import { useState } from "react";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import LeadImport from "../components/LeadImport";
import MySubmissions from "../components/MySubmissions";
import { ReviewDetail, ReviewQueue } from "../components/Review";
import SubmissionWorkspace from "../components/SubmissionWorkspace";

// The Events routes: mapping a raw lead file, your own submissions, and the review queue.
//
// Opening one list is TRANSIENT STATE layered over the route rather than a route of
// its own — the same shape Email Workbench's editor uses, and for the same reason. The
// workspace holds a debounced local model with undo history; a URL you can reload into
// would advertise that it survives a reload, and it doesn't.
//
// Each screen carries its own back affordance (WorkspaceHead), so leaving is never the
// browser button.

// ---- My submissions ---------------------------------------------------------

export function EventsMinePage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.events}
      title="My submissions"
      // The workspace is a grid that wants every pixel of height, and it names the
      // event in its own head — so the page's standing explanation steps aside.
      subtitle={
        openId ? undefined : "One list per event, uploaded after the event has run."
      }
    >
      {openId ? (
        <SubmissionWorkspace id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <MySubmissions onOpen={setOpenId} />
      )}
    </MarketingOpsShell>
  );
}

// ---- Review queue -----------------------------------------------------------

export function EventsReviewPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.events}
      title="Review queue"
      subtitle={
        openId ? undefined : "Lists submitted by regional marketing managers."
      }
    >
      {openId ? (
        <ReviewDetail id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <ReviewQueue onOpen={setOpenId} />
      )}
    </MarketingOpsShell>
  );
}

// ---- Lead import ------------------------------------------------------------------
//
// One screen: the file is read and mapped in the browser, and nothing is kept on the
// server, so there is no run to open or come back to.

export function EventsLeadImportPage() {
  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.events}
      title="Lead Import"
      subtitle="Map a raw event lead file onto the template columns and create a submission from it."
    >
      <LeadImport />
    </MarketingOpsShell>
  );
}
