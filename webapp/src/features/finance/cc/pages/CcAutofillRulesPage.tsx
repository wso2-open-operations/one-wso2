/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import ErrorNotice from "@components/error-notice/ErrorNotice";
import { ccBillsInbox, isCcBackendConfigured } from "@config/apiConfig";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { Alert, Skeleton } from "@wso2/oxygen-ui";
import { useState } from "react";
import FinanceShell from "../../components/FinanceShell";
import { CcTaggingRuleDeleteDialog } from "../CcTaggingRuleDeleteDialog";
import { CcTaggingRuleDialog } from "../CcTaggingRuleDialog";
import { CcTaggingRules } from "../CcTaggingRules";
import { type CcTaggingRule, ccHasAccess } from "../ccTypes";
import { CcAutofillGuideCard, CcAutofillGuideDialog } from "../components/CcAutofillGuide";
import { useCcTaggingRules, useCcUserInfo } from "../useCc";

/** The dialog open over the list: adding a rule, editing one, or deleting one. */
type OpenDialog = { kind: "add" } | { kind: "edit"; rule: CcTaggingRule } | { kind: "delete"; rule: CcTaggingRule };

/** Finance → Credit Card Expenses → Autofill Rules: the card holder's own rules. */
export default function CcAutofillRulesPage() {
  const userInfo = useCcUserInfo();
  const identity = useAsgardeoSub().state;
  const sub = identity.status === "ready" ? identity.sub : undefined;
  const isHolder = ccHasAccess(userInfo.data, "cc_owner");
  const rules = useCcTaggingRules(isHolder);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const close = () => setDialog(null);

  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Autofill Rules"
      subtitle="Rules that fill in your card transactions' expense details when a bill matches."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      {userInfo.isLoading ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : userInfo.isError ? (
        <ErrorNotice
          error={userInfo.error}
          onRetry={() => void userInfo.refetch()}
          retrying={userInfo.isFetching}
        >
          Couldn&apos;t check your access to this page.
        </ErrorNotice>
      ) : !isHolder || !userInfo.data ? (
        <Alert severity="info">Autofill rules are for card holders.</Alert>
      ) : (
        <>
          {/* Until the rules load, the card counts them as there, so it doesn't lose its Got it mid-read. */}
          <CcAutofillGuideCard
            key={sub}
            sub={sub}
            hasRules={rules.data?.length !== 0}
          />
          <CcTaggingRules
            onAdd={() => setDialog({ kind: "add" })}
            onEdit={(rule) => setDialog({ kind: "edit", rule })}
            onDelete={(rule) => setDialog({ kind: "delete", rule })}
            onHowItWorks={() => setGuideOpen(true)}
          />
          <CcAutofillGuideDialog
            open={guideOpen}
            onClose={() => setGuideOpen(false)}
            inbox={ccBillsInbox}
            workEmail={userInfo.data.workEmail}
          />
        </>
      )}

      {dialog?.kind === "add" && <CcTaggingRuleDialog rule={null} onClose={close} />}
      {dialog?.kind === "edit" && <CcTaggingRuleDialog rule={dialog.rule} onClose={close} />}
      {dialog?.kind === "delete" && <CcTaggingRuleDeleteDialog rule={dialog.rule} onClose={close} />}
    </FinanceShell>
  );
}
