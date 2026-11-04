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


import { useMemo, useState } from "react";
import { Box, Button, DataGrid, Stack } from "@wso2/oxygen-ui";
import { FINANCE_GRID_SX } from "../util/financeGridSx";
import { ToolbarNoExport } from "./ccGridToolbar";
import { selectedIds } from "./ccSelection";
import { useAccessToken } from "@hooks/useAccessToken";
import { ccServiceUrls } from "@config/apiConfig";
import { StatusChip, ccStatusMeta } from "../components/FinanceChips";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { bareAmount, formatNice } from "../util/financeFormat";
import { fetchBase64Attachment, type ReceiptSource } from "../util/financeReceipts";
import type { CcAttachmentType, CcTransaction } from "./ccTypes";

/**
 * The transaction table Pending and Approve share.
 *
 * On the grid, like the source's (PendingTransactionsDataGrid /
 * ApproveTransactionsDataGrid). Hand-built, it had no search, no sorting, no
 * paging and no column control — everything the source gets from the component
 * itself. `showToolbar` is v8's composed toolbar; export is deliberately not
 * added here, because both these screens show other people's spend and the
 * source offers export only on history.
 *
 * Selection stays a controlled `Set<number>` owned by the caller rather than
 * the grid's own model: the caller decides what is actionable from the approve
 * role, and it needs the ids to post. `isRowSelectable` reuses that same
 * predicate so a row the mode cannot action cannot be ticked.
 *
 * The toolbar is composed here rather than taken from `showToolbar`, which
 * includes CSV and print export. Both these screens show other people's card
 * spend, and of the source's five grids only submission-history offers export
 * — so a lead must not be handed a one-click download of their reports'
 * transactions just because the default toolbar has the button.
 */
export function CcTxnTable({
  txns,
  showUser,
  showCard,
  selection,
  edit,
  onOpen,
}: {
  txns: CcTransaction[];
  showUser?: boolean;
  showCard?: boolean;
  selection?: {
    checked: Set<number>;
    onToggle: (id: number) => void;
    isSelectable: (t: CcTransaction) => boolean;
  };
  /**
   * Offers an Edit action per row. `canEdit` decides which rows get one —
   * PendingTransactionsDataGrid.tsx:232-236 allows it only while the claim is
   * still with the lead.
   */
  edit?: { canEdit: (t: CcTransaction) => boolean; onEdit: (t: CcTransaction) => void };
  /** Opens a row's full detail. Rendered in the same trailing action column. */
  onOpen?: (t: CcTransaction) => void;
}) {
  const getAccessToken = useAccessToken();
  const [load, setLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);

  const columns = useMemo<DataGrid.GridColDef<CcTransaction>[]>(() => {
    const view = (id: number, attachmentType: CcAttachmentType) => {
      setLoad(() => async () => {
        const accessToken = await getAccessToken();
        return fetchBase64Attachment(ccServiceUrls.attachment(id, attachmentType), accessToken);
      });
    };

    const cols: DataGrid.GridColDef<CcTransaction>[] = [
      { field: "id", headerName: "ID", width: 80 },
      { field: "txnDescription", headerName: "Description", flex: 1, minWidth: 180 },
    ];
    if (showUser) {
      cols.push({ field: "employeeEmail", headerName: "User", flex: 0.8, minWidth: 180 });
    }
    if (showCard) {
      cols.push({ field: "ccNumber", headerName: "Card", width: 120 });
    }
    cols.push(
      {
        field: "txnDate",
        headerName: "Date",
        width: 130,
        renderCell: (p) => formatNice(p.value as string),
      },
      {
        // Bare, because the header carries the currency — utils.ts:44-49.
        field: "txnAmount",
        headerName: "Amount($)",
        type: "number",
        width: 120,
        renderCell: (p) => bareAmount(p.value as number),
      },
      {
        field: "attachments",
        headerName: "Files",
        width: 150,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const t = p.row;
          if (!t.receiptFileName && !t.contractFileName) {
            return <Box component="span" sx={{ color: "text.disabled" }}>—</Box>;
          }
          return (
            <Stack direction="row" spacing={0.5}>
              {t.receiptFileName && (
                <Button size="small" variant="text" onClick={() => view(t.id, "receipt")} sx={{ textTransform: "none", minWidth: 0, px: 0.5 }}>
                  Receipt
                </Button>
              )}
              {t.contractFileName && (
                <Button size="small" variant="text" onClick={() => view(t.id, "contract")} sx={{ textTransform: "none", minWidth: 0, px: 0.5 }}>
                  Contract
                </Button>
              )}
            </Stack>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 150,
        renderCell: (p) => {
          const meta = ccStatusMeta(p.row.status);
          return <StatusChip label={meta.label} color={meta.color} />;
        },
      },
    );
    if (edit || onOpen) {
      cols.push({
        field: "actions",
        headerName: "",
        width: 150,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (p) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {onOpen && (
              <Button size="small" variant="text" onClick={() => onOpen(p.row)} sx={{ textTransform: "none", fontWeight: 600 }}>
                Details
              </Button>
            )}
            {edit?.canEdit(p.row) && (
              <Button size="small" variant="outlined" onClick={() => edit.onEdit(p.row)} sx={{ textTransform: "none", fontWeight: 600 }}>
                Edit
              </Button>
            )}
          </Stack>
        ),
      });
    }
    return cols;
  }, [showUser, showCard, edit, onOpen, getAccessToken]);

  return (
    <>
      <Box sx={{ height: 560, width: "100%" }}>
        <DataGrid.DataGrid
          rows={txns}
          columns={columns}
          showToolbar
          slots={{ toolbar: ToolbarNoExport }}
          density="compact"
          disableRowSelectionOnClick
          checkboxSelection={Boolean(selection)}
          isRowSelectable={(p) => (selection ? selection.isSelectable(p.row) : true)}
          rowSelectionModel={
            selection
              ? { type: "include", ids: new Set(selection.checked) }
              : undefined
          }
          onRowSelectionModelChange={(model) => {
            if (!selection) return;
            // Resolve include/exclude first — see selectedIds — then turn the
            // result into the per-id toggles the caller's Set expects, so one
            // click does not silently drop the rest.
            const next = selectedIds(model, txns);
            for (const t of txns) {
              if (next.has(t.id) !== selection.checked.has(t.id)) selection.onToggle(t.id);
            }
          }}
          initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
          pageSizeOptions={[5, 10, 20, 25, 50]}
          sx={FINANCE_GRID_SX}
        />
      </Box>
      <ReceiptViewer title="Attachment" load={load} onClose={() => setLoad(null)} />
    </>
  );
}
