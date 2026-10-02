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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { Divider, Grid, Stack, Typography } from "@wso2/oxygen-ui";
import type {
  UmtHotfixInfo,
  UmtUpdateDependency,
  UmtUpdateProduct,
  UmtUpdateSummary,
} from "../api/umtUpdates";
import { useUmtGate } from "../api/useUmtGate";
import {
  useUmtSaveIssues,
  useUmtSavePublicPullRequests,
  useUmtSaveTestPullRequests,
} from "../api/useUmtUpdateActions";
import { isValidGithubIssueUrl } from "../lib/umtCreateUpdate";
import { useUmtUpdateViewData } from "../api/useUmtUpdateViewData";
import EditableLinkSection from "./UmtEditableLinkSection";
import {
  ProductAnalysisSection,
  PullRequestAnalysisSection,
} from "./UmtUpdateAnalysisSections";
import {
  DividedTableSection,
  displayValue,
  renderLinkValue,
  DenseTable,
  SectionError,
  SectionSkeleton,
  type DenseColumn,
  type ViewQueryState,
} from "./umtViewSectionPrimitives";

export default function UmtUpdateViewSections({
  id,
  update,
}: {
  id: string;
  update: UmtUpdateSummary;
}) {
  const viewData = useUmtUpdateViewData(id, update.lifecycleState, Boolean(update.isHotfix));
  const publicPullRequests = update.publicPullRequests ?? [];
  const gate = useUmtGate();
  const saveIssues = useUmtSaveIssues(id);
  const savePublicPrs = useUmtSavePublicPullRequests(id);
  const saveTestPrs = useUmtSaveTestPullRequests(id);
  // The add action is hidden once an update is Released; the admin-only
  // delete column follows the same rule this codebase already applies
  // elsewhere (e.g. File Approval's promote gate).
  const canAddLinks = update.lifecycleState !== "Released";

  return (
    <Stack spacing={3} sx={{ mt: 3 }}>
      <Grid container spacing={{ xs: 3, lg: 4 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <EditableLinkSection
            title="Public GitHub Issues"
            ariaLabel="Public GitHub issues"
            columnLabel="Public Git Issues"
            emptyText="No Public GitHub Issues Available"
            items={update.issues ?? []}
            canAdd={canAddLinks}
            canDelete={gate.isAdmin}
            requireAtLeastOne
            addDialogTitle="Add Public GitHub Issues"
            addFieldLabel="Public GitHub Issue"
            validate={(value) => (isValidGithubIssueUrl(value) ? undefined : "Invalid Public GitHub Issue")}
            isSaving={saveIssues.isPending}
            onSave={(next) => saveIssues.mutateAsync(next)}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <EditableLinkSection
            title="Public Pull Requests"
            ariaLabel="Public pull requests"
            columnLabel="Public Pull Requests"
            emptyText="No Public Pull Requests Available"
            items={publicPullRequests}
            canAdd={canAddLinks}
            canDelete={gate.isAdmin}
            addDialogTitle="Add Public Pull Requests"
            addFieldLabel="Public Pull Request"
            isSaving={savePublicPrs.isPending}
            onSave={(next) => savePublicPrs.mutateAsync(next)}
          />
        </Grid>
      </Grid>

      <Divider flexItem />
      <EditableLinkSection
        title="Integration Pull Requests"
        ariaLabel="Integration pull requests"
        columnLabel="Integration Test Pull Requests"
        hideColumnHeader
        emptyText="No Integration Test Pull Requests Available"
        items={update.testPullRequests ?? []}
        canAdd={canAddLinks}
        canDelete={gate.isAdmin}
        addDialogTitle="Add Integration Test Pull Requests"
        addFieldLabel="Integration Test Pull Request"
        isSaving={saveTestPrs.isPending}
        onSave={(next) => saveTestPrs.mutateAsync(next)}
      />

      <DividedTableSection title="Products">
        <DenseTable
          ariaLabel="Products"
          columns={productColumns}
          rows={update.products ?? []}
          rowKey={(row, index) => `${row.product?.id ?? row.product?.name ?? "product"}-${index}`}
        />
      </DividedTableSection>

      <PullRequestAnalysisSection query={viewData.pullRequestAnalysis} />
      <ProductAnalysisSection query={viewData.productAnalysis} />

      {(update.securityAdvisories?.length ?? 0) > 0 && (
        <DividedTableSection title="Security Advisories">
          <DenseTable
            ariaLabel="Security advisories"
            columns={[
              {
                key: "security-advisory",
                label: "Security Advisory Name",
                render: (row) => displayValue(row.securityAdvisoryName),
              },
            ]}
            rows={update.securityAdvisories ?? []}
            rowKey={(row, index) => `${row.securityAdvisoryName ?? "advisory"}-${index}`}
          />
        </DividedTableSection>
      )}

      <DependencySection query={viewData.dependencies} />
      {update.isHotfix && <HotfixSection query={viewData.hotfixInfo} />}

      {update.lifecycleState === "Completed" && (
        <DividedTableSection title="Completion Details">
          <DenseTable
            ariaLabel="Completion details"
            columns={[
              {
                key: "pull-requests",
                label: "Public Pull Requests",
                render: (row) => displayValue(row.pullRequests.join(", ")),
              },
              {
                key: "reason",
                label: "Completion Reason",
                render: (row) => displayValue(row.reason),
              },
            ]}
            rows={[{ pullRequests: publicPullRequests, reason: update.reason }]}
            rowKey={() => "completion-details"}
          />
        </DividedTableSection>
      )}
    </Stack>
  );
}

function DependencySection({ query }: { query: ViewQueryState<UmtUpdateDependency[]> }) {
  if (query.isPending) return null;
  if (query.isError) {
    return <SectionError title="Regression Updates" onRetry={() => void query.refetch()} />;
  }

  const rows = query.data ?? [];
  if (rows.length === 0) return null;
  return (
    <DividedTableSection title="Regression Updates">
      <DenseTable
        ariaLabel="Regression updates"
        columns={[
          { key: "id", label: "ID", render: (row) => displayValue(row.to?.id) },
        ]}
        rows={rows}
        rowKey={(row, index) => `${row.to?.id ?? "dependency"}-${index}`}
      />
    </DividedTableSection>
  );
}

function HotfixSection({ query }: { query: ViewQueryState<UmtHotfixInfo> }) {
  if (query.isPending) return <SectionSkeleton title="Hotfix Information" />;
  if (query.isError) {
    return <SectionError title="Hotfix Information" onRetry={() => void query.refetch()} />;
  }

  return (
    <DividedTableSection title="Hotfix Information">
      <Stack spacing={2.5}>
        <DenseTable
          ariaLabel="Hotfix locations"
          columns={[
            { key: "hotfix-url", label: "Hotfix URL", render: (row) => renderLinkValue(row.hotfixUrl) },
            { key: "upload-url", label: "Upload URL", render: (row) => renderLinkValue(row.uploadUrl) },
          ]}
          rows={[{ hotfixUrl: query.data?.hotfixUrl, uploadUrl: query.data?.uploadUrl }]}
          rowKey={() => "hotfix-locations"}
        />
        {(query.data?.hotfixList?.length ?? 0) > 0 && (
          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Files
            </Typography>
            <DenseTable
              ariaLabel="Hotfix files"
              columns={[{ key: "file", label: "Hotfix List", render: displayValue }]}
              rows={query.data?.hotfixList ?? []}
              rowKey={(row, index) => `${row}-${index}`}
            />
          </Stack>
        )}
      </Stack>
    </DividedTableSection>
  );
}

// Shared by the View tab's three editable link-list sections (Public GitHub
// Issues, Public Pull Requests, Integration Test Pull Requests). Each dialog
// open adds one item, matching every other "Add X" dialog already in this
// feature (Manual Files, Bundle Info, Pull Requests, Security Advisories).

const productColumns: DenseColumn<UmtUpdateProduct>[] = [
  { key: "product", label: "Product", flex: 0.5, render: (row) => displayValue(row.product?.name) },
  { key: "version", label: "Version", flex: 0.5, render: (row) => displayValue(row.product?.version) },
  { key: "description", label: "Description", render: (row) => displayValue(row.description) },
  { key: "instruction", label: "Instruction", render: (row) => displayValue(row.instruction) },
  { key: "test-pr", label: "Test PR", render: (row) => renderLinkValue(row.testPr) },
  {
    key: "ignore-test-reason",
    label: "Ignore Test Reason",
    render: (row) => displayValue(row.ignoreTestReason),
  },
];
