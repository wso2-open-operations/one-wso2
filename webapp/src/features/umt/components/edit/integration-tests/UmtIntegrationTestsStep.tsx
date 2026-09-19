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

import { useMemo, useState } from "react";
import { Button, Checkbox, Chip, Divider, FormControlLabel, Paper, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtProductIntegrationTestRequest, UmtUpdateProduct, UmtUpdateSummary } from "../../../api/umtUpdates";
import { useUmtSaveIntegrationTests } from "../../../api/useUmtIntegrationTests";
import { isIntegrationTestsSaveDisabled, type UmtIntegrationTestDraftRow } from "../../../lib/umtIntegrationTests";

type ProductWithId = UmtUpdateProduct & { productId: string | number };

function seedTestPrDrafts(products: ProductWithId[]): Record<string, string> {
  return Object.fromEntries(products.map((p) => [String(p.productId), p.testPr ?? ""]));
}

function seedIgnoreDrafts(products: ProductWithId[]): Record<string, boolean> {
  return Object.fromEntries(
    products.map((p) => [String(p.productId), Boolean(p.ignoreTestReason?.trim()) && !p.testPr?.trim()]),
  );
}

function seedReasonDrafts(products: ProductWithId[]): Record<string, string> {
  return Object.fromEntries(products.map((p) => [String(p.productId), p.ignoreTestReason ?? ""]));
}

export default function UmtIntegrationTestsStep({ id, update }: { id: string; update: UmtUpdateSummary }) {
  const { showSuccess, showError } = useNotifications();
  const saveMutation = useUmtSaveIntegrationTests(id);
  const isContainerizedUpdate = update.isContainerizedUpdate ?? false;
  const products = useMemo(
    () => (update.products ?? []).filter((p): p is ProductWithId => p.productId != null),
    [update.products],
  );

  const [isDirty, setIsDirty] = useState(false);
  const [testPrDrafts, setTestPrDrafts] = useState<Record<string, string>>(() =>
    seedTestPrDrafts(products),
  );
  const [ignoreDrafts, setIgnoreDrafts] = useState<Record<string, boolean>>(() =>
    seedIgnoreDrafts(products),
  );
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>(() =>
    seedReasonDrafts(products),
  );
  const [helmChartTagDraft, setHelmChartTagDraft] = useState(() => products[0]?.helmChartTag ?? "");

  // Reseed on a confirmed save (isDirty cleared, then the next `products`
  // reference picks up the saved server state) or a different update — never
  // just because `products`' array reference changed. `["umt-update"]` is
  // invalidated by many unrelated mutations elsewhere on this page, each
  // handing back a structurally-new (even if content-identical) products
  // array; reseeding on that alone while the user has unsaved Test PR /
  // ignore-reason / Helm Chart Tag drafts would silently discard them.
  const [lastProducts, setLastProducts] = useState(products);
  const [lastId, setLastId] = useState(id);
  const identityChanged = id !== lastId;
  if (identityChanged || (!isDirty && products !== lastProducts)) {
    setLastId(id);
    setLastProducts(products);
    if (identityChanged) setIsDirty(false);
    setTestPrDrafts(seedTestPrDrafts(products));
    setIgnoreDrafts(seedIgnoreDrafts(products));
    setReasonDrafts(seedReasonDrafts(products));
    setHelmChartTagDraft(products[0]?.helmChartTag ?? "");
  }

  const draftRows: UmtIntegrationTestDraftRow[] = products.map((p) => {
    const key = String(p.productId);
    return {
      testPr: testPrDrafts[key] ?? "",
      isIgnored: ignoreDrafts[key] ?? false,
      ignoreReason: reasonDrafts[key] ?? "",
    };
  });

  const isSaveDisabled = isIntegrationTestsSaveDisabled({
    isDirty,
    isContainerizedUpdate,
    helmChartTag: helmChartTagDraft,
    rows: draftRows,
  });

  async function handleSave() {
    const payload: UmtProductIntegrationTestRequest[] = products.map((product) => {
      const key = String(product.productId);
      const ignored = ignoreDrafts[key] ?? false;
      return {
        productId: product.productId,
        description: product.description ?? "",
        instruction: product.instruction ?? "",
        testPr: isContainerizedUpdate ? "" : ignored ? "" : testPrDrafts[key] ?? "",
        ignoreTestReason: isContainerizedUpdate ? "" : ignored ? reasonDrafts[key] ?? "" : "",
        helmChartTag: isContainerizedUpdate ? helmChartTagDraft : "",
      };
    });
    try {
      await saveMutation.mutateAsync(payload);
      showSuccess("Integration test details saved.");
      setIsDirty(false);
    } catch (error) {
      showError(`Failed to save integration test details. ${describeError(error)}`);
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Integration Tests</Typography>

      {isContainerizedUpdate ? (
        <TextField
          label="Helm Chart Tag"
          value={helmChartTagDraft}
          onChange={(event) => {
            setHelmChartTagDraft(event.target.value);
            setIsDirty(true);
          }}
          fullWidth
        />
      ) : (
        <Stack spacing={2}>
          {products.map((product) => {
            const key = String(product.productId);
            const isIgnored = ignoreDrafts[key] ?? false;
            return (
              <Paper key={key} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="h6">
                      {product.product?.name ?? "N/A"} - {product.product?.version ?? "N/A"}
                    </Typography>
                    {(product.type === "CompatibleInitial" || product.type === "Compatible") && (
                      <Chip label={product.type === "CompatibleInitial" ? "Compatible Initial" : "Compatible"} size="small" />
                    )}
                  </Stack>
                  <TextField
                    label="Test PR"
                    value={testPrDrafts[key] ?? ""}
                    onChange={(event) => {
                      setTestPrDrafts((prev) => ({ ...prev, [key]: event.target.value }));
                      setIsDirty(true);
                    }}
                    disabled={isIgnored}
                    fullWidth
                    multiline
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isIgnored}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setIgnoreDrafts((prev) => ({ ...prev, [key]: checked }));
                          if (checked) setTestPrDrafts((prev) => ({ ...prev, [key]: "" }));
                          if (!checked) setReasonDrafts((prev) => ({ ...prev, [key]: "" }));
                          setIsDirty(true);
                        }}
                      />
                    }
                    label="Ignore Test"
                  />
                  {isIgnored && (
                    <TextField
                      label="Ignore Test Reason"
                      value={reasonDrafts[key] ?? ""}
                      onChange={(event) => {
                        setReasonDrafts((prev) => ({ ...prev, [key]: event.target.value }));
                        setIsDirty(true);
                      }}
                      fullWidth
                      multiline
                    />
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Divider />

      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button variant="contained" disabled={isSaveDisabled} loading={saveMutation.isPending} onClick={() => void handleSave()}>
          Save
        </Button>
      </Stack>
    </Stack>
  );
}
