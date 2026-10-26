import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseClaimPrintout } from "./ExpenseClaimPrintout";
import type { ApprovalClaim } from "./expenseApprovalTypes";
import type { ExpenseTransaction } from "../expenseTypes";
import type { ReceiptSource } from "../../util/financeReceipts";

function line(over: Partial<ExpenseTransaction> = {}): ExpenseTransaction {
  return {
    amount: 100,
    currency: "LKR",
    currencyConversionRate: 1,
    reimbursementAmount: 100,
    reimbursementCurrency: "LKR",
    expenseTypeId: 1,
    expenseType: "Taxi",
    date: "2026-10-01",
    comment: "",
    receiptUrl: "receipt.pdf",
    travelJobNumber: null,
    ...over,
  };
}

function claimOf(transactions: ExpenseTransaction[]): ApprovalClaim {
  return {
    id: "EXP-1",
    transactions,
    totalAmount: 100,
    currencyCode: "LKR",
    employeeEmail: "someone@wso2.com",
    leadEmails: [],
    statusDetails: {
      status: "PENDING_LEAD",
      leadApprovedDate: null,
      leadRejectedReason: null,
      leadRejectedDate: null,
      financeApproverEmail: null,
      financeApprovedDate: null,
      financeRejectedDate: null,
    },
    createdDate: "2026-10-01T00:00:00Z",
  };
}

const image: ReceiptSource = { url: "blob:image", type: "image/jpeg" };
const pdf: ReceiptSource = { url: "blob:pdf", type: "application/pdf" };

describe("ExpenseClaimPrintout receipts", () => {
  it("prints an image receipt as a picture", () => {
    render(<ExpenseClaimPrintout claim={claimOf([line()])} receipts={[image]} />);

    expect(screen.getByAltText("Receipt for claim item 1")).toBeInTheDocument();
  });

  it("gives a PDF receipt a page naming it, rather than dropping it", () => {
    render(<ExpenseClaimPrintout claim={claimOf([line()])} receipts={[pdf]} />);

    expect(screen.getByText("Claim Item 1 Receipt")).toBeInTheDocument();
    expect(screen.getByText(/this receipt is a pdf/i)).toBeInTheDocument();
  });

  it("says so when an attached receipt could not be loaded", () => {
    render(<ExpenseClaimPrintout claim={claimOf([line()])} receipts={[null]} />);

    expect(screen.getByText("Claim Item 1 Receipt")).toBeInTheDocument();
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("gives a line with no receipt attached no page at all", () => {
    render(
      <ExpenseClaimPrintout claim={claimOf([line({ receiptUrl: null })])} receipts={[null]} />,
    );

    expect(screen.queryByText("Claim Item 1 Receipt")).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
  });

  it("keeps a page for every receipt when images and PDFs are mixed", () => {
    render(
      <ExpenseClaimPrintout
        claim={claimOf([line(), line(), line()])}
        receipts={[image, pdf, image]}
      />,
    );

    expect(screen.getByText("Claim Item 1 Receipt")).toBeInTheDocument();
    expect(screen.getByText("Claim Item 2 Receipt")).toBeInTheDocument();
    expect(screen.getByText("Claim Item 3 Receipt")).toBeInTheDocument();
    // By alt text, not role: the printout is display:none until print, which
    // takes it out of the accessibility tree that getByRole consults.
    expect(screen.getAllByAltText(/Receipt for claim item/)).toHaveLength(2);
  });
});
