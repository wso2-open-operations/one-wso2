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

import { Chip, Stack, Typography } from "@wso2/oxygen-ui";
import type {
  UmtFileOperation,
  UmtProductAnalysis,
  UmtProductAnalysisItem,
  UmtPullRequestAnalysis,
  UmtPullRequestAnalysisItem,
} from "../api/umtUpdates";
import {
  DividedTableSection,
  displayValue,
  renderLinkValue,
  DenseTable,
  SectionError,
  type DenseColumn,
  type ViewQueryState,
} from "./umtViewSectionPrimitives";

export function PullRequestAnalysisSection({ query }: { query: ViewQueryState<UmtPullRequestAnalysis> }) {
  if (query.isPending) return null;
  if (query.isError) {
    return <SectionError title="Pull Request Analysis Results" onRetry={() => void query.refetch()} />;
  }

  const pullRequests = query.data?.pullRequests ?? [];
  const identifiedFiles = query.data?.identifiedFileOperations ?? [];
  const additionalFiles = query.data?.additionalFileOperations ?? [];
  if (pullRequests.length + identifiedFiles.length + additionalFiles.length === 0) return null;

  return (
    <>
      {pullRequests.length > 0 && (
        <DividedTableSection title="Pull Request Analysis Results">
          <Stack spacing={2.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Pull Requests
            </Typography>
            <DenseTable
              ariaLabel="Analyzed pull requests"
              columns={pullRequestAnalysisColumns}
              rows={pullRequests}
              rowKey={(row, index) => `${row.pr ?? "pull-request"}-${index}`}
            />
            {identifiedFiles.length > 0 && (
              <AnalysisFileTable title="Files" rows={identifiedFiles} />
            )}
          </Stack>
        </DividedTableSection>
      )}
      {pullRequests.length === 0 && identifiedFiles.length > 0 && (
        <DividedTableSection title="Pull Request Analysis Results">
          <AnalysisFileTable title="Files" rows={identifiedFiles} />
        </DividedTableSection>
      )}
      {additionalFiles.length > 0 && (
        <DividedTableSection title="Additional Files">
          <DenseTable
            ariaLabel="Additional files"
            columns={fileOperationColumns}
            rows={additionalFiles}
            rowKey={(row, index) => `${row.file ?? "file"}-${index}`}
          />
        </DividedTableSection>
      )}
    </>
  );
}

export function ProductAnalysisSection({ query }: { query: ViewQueryState<UmtProductAnalysis> }) {
  if (query.isPending) return null;
  if (query.isError) {
    return <SectionError title="Product Analysis Results" onRetry={() => void query.refetch()} />;
  }

  const compatible = query.data?.compatibleProducts ?? [];
  const applicable = query.data?.applicableProducts ?? [];
  if (compatible.length + applicable.length === 0) return null;

  // One section for both groups: the early return above already guarantees at
  // least one product, so gating the heading on `compatible` alone left an
  // update with only partially-applicable products with no heading at all.
  return (
    <DividedTableSection title="Product Analysis Results">
      <Stack spacing={3}>
        {compatible.map((product, index) => (
          <ProductAnalysisTable
            key={`compatible-${product.productId ?? index}`}
            product={product}
            status="Fully Applicable"
            color="success"
          />
        ))}
        {applicable.map((product, index) => (
          <ProductAnalysisTable
            key={`applicable-${product.productId ?? index}`}
            product={product}
            status="Partially Applicable"
            color="warning"
          />
        ))}
      </Stack>
    </DividedTableSection>
  );
}

function ProductAnalysisTable({
  product,
  status,
  color,
}: {
  product: UmtProductAnalysisItem;
  status: string;
  color: "success" | "warning";
}) {
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {displayValue(product.productName)} - {displayValue(product.baseVersion)}
        </Typography>
        <Chip label={status} color={color} size="small" />
      </Stack>
      <DenseTable
        ariaLabel={`${status} product file operations`}
        columns={fileOperationColumns}
        rows={product.identifiedFiles ?? []}
        rowKey={(row, index) => `${row.file ?? "file"}-${index}`}
      />
    </Stack>
  );
}

function AnalysisFileTable({ title, rows }: { title: string; rows: UmtFileOperation[] }) {
  return (
    <Stack spacing={1}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <DenseTable
        ariaLabel={title}
        columns={fileOperationColumns}
        rows={rows}
        rowKey={(row, index) => `${row.file ?? "file"}-${index}`}
      />
    </Stack>
  );
}

const pullRequestAnalysisColumns: DenseColumn<UmtPullRequestAnalysisItem>[] = [
  { key: "pull-request", label: "Pull Requests", render: (row) => renderLinkValue(row.pr) },
  {
    key: "preferred-version",
    label: "Preferred Version",
    render: (row) => displayValue(row.preferredVersion),
  },
];

const fileOperationColumns: DenseColumn<UmtFileOperation>[] = [
  { key: "file", label: "Files", flex: 0.5, render: (row) => displayValue(row.file) },
  { key: "operation", label: "Operation", flex: 0.25, minWidth: 90, render: (row) => displayValue(row.operation) },
  { key: "source", label: "Source", render: (row) => renderLinkValue(row.downloadURL) },
];
