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

// ReportTemplate.tsx — the finance-approver "download report" PDF, one page
// of claim + line-item details plus a page of receipts. Simplified from the
// source in one respect: it embeds image receipts directly but, rather than
// pulling in pdfjs-dist to rasterize PDF receipts page-by-page, prints a
// note for those instead (see ClaimReportDocument below).

import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { ExpenseClaim } from "./expenseTypes";

const BORDER = "#D0D5DD";
const BRAND = "#F14E23"; // WSO2 orange pulse

const styles = StyleSheet.create({
  page: { paddingTop: 25, paddingHorizontal: 35, paddingBottom: 25, fontSize: 10 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderColor: BRAND,
    borderRadius: 6,
    backgroundColor: "#FDEEE9",
    padding: 10,
    marginBottom: 15,
  },
  cardRow: { flexDirection: "row" },
  cardSpace: { paddingTop: 8 },
  titleColumn: { flex: 1, fontWeight: 700, fontSize: 10 },
  column: { flex: 2, fontSize: 10 },
  table: { width: "100%", marginTop: 14 },
  tableRow: { flexDirection: "row" },
  leftCell: {
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    flex: 1,
    padding: 8,
    fontSize: 10,
    backgroundColor: "#F7F7F8",
  },
  rightCell: {
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    flex: 2.2,
    padding: 8,
    fontSize: 10,
  },
  header: {
    width: "100%",
    textAlign: "center",
    padding: 8,
    backgroundColor: "#EEEEEE",
    borderWidth: 1,
    borderColor: BORDER,
    fontSize: 12,
  },
  receiptHeader: { width: "100%", textAlign: "center", paddingBottom: 10, fontSize: 14 },
  receiptBody: { paddingTop: 15, paddingHorizontal: 20 },
  note: { fontSize: 10, color: "#667085", textAlign: "center", paddingTop: 20 },
});

// A receipt already fetched (as an object/data URL) for embedding — see
// ExpenseClaimDetailsDialog's downloadReport, which fetches one per line
// before handing them all to this document.
export interface ClaimReceiptAsset {
  index: number;
  url: string;
  type: string;
}

export function ClaimReportDocument({
  claim,
  receipts,
}: {
  claim: ExpenseClaim;
  receipts: ClaimReceiptAsset[];
}) {
  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>Expense claim report</Text>
        <View style={styles.card}>
          {(
            [
              ["Claim ID", claim.id],
              ["Total Reimbursement Amount", `${claim.totalAmount.toFixed(2)} ${claim.currencyCode ?? ""}`],
              ["Submitted Date", claim.createdDate.slice(0, 10)],
              ["Employee", claim.employeeEmail],
            ] as const
          ).map(([title, value], i) => (
            <View key={title} style={i === 0 ? styles.cardRow : [styles.cardRow, styles.cardSpace]}>
              <Text style={styles.titleColumn}>{title}</Text>
              <Text style={styles.column}>{value}</Text>
            </View>
          ))}
        </View>

        {claim.transactions.map((t, i) => (
          <View key={i} style={styles.table} wrap={false}>
            <View style={styles.tableRow}>
              <View style={styles.header}>
                <Text>Claim Item {i + 1}</Text>
              </View>
            </View>
            {(
              [
                ["Bill Date", t.date],
                ["Job Number", t.travelJobNumber || "N/A"],
                ["Expense Type", t.expenseType],
                ["Bill Amount", `${t.amount.toFixed(2)} ${t.currency}`],
                [
                  "Reimbursement Amount",
                  `${t.reimbursementAmount.toFixed(2)} ${t.reimbursementCurrency} (conversion rate: ${t.currencyConversionRate})`,
                ],
                ["Comment", t.comment || "—"],
              ] as const
            ).map(([title, value]) => (
              <View key={title} style={styles.tableRow}>
                <View style={styles.leftCell}>
                  <Text>{title}</Text>
                </View>
                <View style={styles.rightCell}>
                  <Text>{value}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </Page>

      <Page style={styles.page}>
        {claim.transactions.map((t, i) => {
          const asset = receipts.find((r) => r.index === i);
          return (
            <View key={i} break={i !== 0} style={styles.receiptBody}>
              <Text style={styles.receiptHeader}>Claim Item {i + 1} Receipt</Text>
              {!t.receiptUrl ? (
                <Text style={styles.note}>No receipt attached to this line.</Text>
              ) : !asset ? (
                <Text style={styles.note}>Couldn't load this receipt.</Text>
              ) : asset.type.startsWith("image/") ? (
                <Image src={asset.url} />
              ) : (
                // Rasterizing a PDF receipt page-by-page needs pdfjs-dist on
                // top of @react-pdf/renderer; out of scope here — view it in
                // the app instead (the claim detail dialog's Receipt button).
                <Text style={styles.note}>
                  This receipt is a PDF file. Open it from the claim's Receipt button in the app to view it —
                  it isn't rendered into this report.
                </Text>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
