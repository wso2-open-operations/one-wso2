import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseClaimPrintout } from "./ExpenseClaimPrintout";
import type { ApprovalClaim } from "./expenseApprovalTypes";
import type { ExpenseTransaction } from "../expenseTypes";
import type { ReceiptPages } from "./useClaimReceipts";

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

// What the hook hands the report: already-rendered pages, one per printed
// page. A PDF arrives here as pictures, so the report never sees a PDF.
const image: ReceiptPages = { pages: ["blob:image"], type: "image/jpeg" };
const pdf: ReceiptPages = { pages: ["data:png-1"], type: "application/pdf" };
const pdfTwoPages: ReceiptPages = { pages: ["data:png-1", "data:png-2"], type: "application/pdf" };
const unreadable: ReceiptPages = { pages: [], type: "application/pdf" };

describe("ExpenseClaimPrintout receipts", () => {
  it("prints an image receipt as a picture", () => {
    render(<ExpenseClaimPrintout claim={claimOf([line()])} receipts={[image]} />);

    expect(screen.getByAltText("Receipt for claim item 1")).toBeInTheDocument();
  });

  it("prints a rendered PDF receipt as a picture", () => {
    render(<ExpenseClaimPrintout claim={claimOf([line()])} receipts={[pdf]} />);

    expect(screen.getByAltText("Receipt for claim item 1")).toBeInTheDocument();
  });

  it("gives a multi-page PDF one page each, numbered", () => {
    render(<ExpenseClaimPrintout claim={claimOf([line()])} receipts={[pdfTwoPages]} />);

    expect(screen.getByText("Claim Item 1 Receipt (page 1 of 2)")).toBeInTheDocument();
    expect(screen.getByText("Claim Item 1 Receipt (page 2 of 2)")).toBeInTheDocument();
    expect(screen.getAllByAltText("Receipt for claim item 1")).toHaveLength(2);
  });

  it("says so when a receipt arrived but could not be read", () => {
    render(<ExpenseClaimPrintout claim={claimOf([line()])} receipts={[unreadable]} />);

    expect(screen.getByText("Claim Item 1 Receipt")).toBeInTheDocument();
    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
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

  it("prints every bill when images and PDFs are mixed", () => {
    render(
      <ExpenseClaimPrintout
        claim={claimOf([line(), line(), line()])}
        receipts={[image, pdf, image]}
      />,
    );

    expect(screen.getByText("Claim Item 1 Receipt")).toBeInTheDocument();
    expect(screen.getByText("Claim Item 2 Receipt")).toBeInTheDocument();
    expect(screen.getByText("Claim Item 3 Receipt")).toBeInTheDocument();
    // All three, not just the images: a PDF reaches the report already
    // rendered to pictures, so it prints like any other bill. By alt text
    // rather than role, as the report is display:none until print and so sits
    // outside the accessibility tree getByRole consults.
    expect(screen.getAllByAltText(/Receipt for claim item/)).toHaveLength(3);
  });
});
