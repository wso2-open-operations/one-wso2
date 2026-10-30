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

import { useState, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { DownloadIcon, EyeIcon, FileTextIcon, SendIcon } from "@wso2/oxygen-ui-icons-react";
import type { DocumentView } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  useAttachOrderForm,
  useDocumentFiles,
  useDocuments,
  useIssueOrderForm,
} from "@features/sales/cado2/quotes/api/useQuoteApi";
import { formatDate, formatDateTime } from "@features/sales/cado2/quotes/form/draftForm";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import SupportingDocumentsSection from "./SupportingDocumentsSection";
import { useHasSupportingDocuments } from "@features/sales/cado2/quotes/api/useSupportingDocuments";

/** Saves a Blob under a file name (a click on a temporary link). */
function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The order form of an approved version:
 *
 *   approved ──[Preview PDF]── watermarked, never stored (DGD-3)
 *            └─[Issue order form]── stored; issue date today, expiry +30
 *   issued   ──[Download]── the same file every time
 *
 * The primary quote's order form also goes to its Salesforce opportunity
 * (D111); the panel says whether it's there, with a retry when it failed.
 *
 * The supporting documents that follow the order form (DGD-10) are listed
 * here too, and can change until Issue; before approval the panel shows
 * only them, when there are any. On an older version they are read-only.
 */
export default function DocumentsPanel({
  quoteId,
  version,
  approved,
  olderVersion = false,
}: {
  quoteId: number;
  version: number;
  /** The version is approved; before that, only the supporting documents show. */
  approved: boolean;
  /** An older version in view mode: the supporting documents can't be changed from it. */
  olderVersion?: boolean;
}): JSX.Element | null {
  if (!approved) return <BeforeApproval quoteId={quoteId} olderVersion={olderVersion} />;
  return <ApprovedOrderForm quoteId={quoteId} version={version} olderVersion={olderVersion} />;
}

/** Before approval: the supporting documents, if the quote has anything to say about them. */
function BeforeApproval({ quoteId, olderVersion }: { quoteId: number; olderVersion: boolean }): JSX.Element | null {
  const visible = useHasSupportingDocuments(quoteId);
  if (!visible) return null;
  return (
    <SectionCard title="Order Form" icon={<FileTextIcon size={18} />}>
      <Typography variant="body2" color="text.secondary">
        The order form can be previewed and issued once the quote is approved.
      </Typography>
      <Divider sx={{ my: 1.5 }} />
      <SupportingDocumentsSection quoteId={quoteId} readOnly={olderVersion} />
    </SectionCard>
  );
}

function ApprovedOrderForm({
  quoteId,
  version,
  olderVersion,
}: {
  quoteId: number;
  version: number;
  olderVersion: boolean;
}): JSX.Element | null {
  const hasSupporting = useHasSupportingDocuments(quoteId);
  const docs = useDocuments(quoteId, version, true);
  const issue = useIssueOrderForm();
  const attach = useAttachOrderForm();
  const notify = useCado2Toast();
  const files = useDocumentFiles();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // What failed and why, shown as the shared ErrorNotice (2026-10-13).
  const [error, setError] = useState<{ what: string; cause: unknown } | null>(null);

  // A failed load says so, rather than the card vanishing (2026-10-13).
  if (docs.error) {
    return (
      <ErrorNotice error={docs.error} onRetry={() => void docs.refetch()} retrying={docs.isFetching}>
        Couldn&apos;t load the order form.
      </ErrorNotice>
    );
  }
  if (!docs.data) return null;
  const d = docs.data;
  const active = d.documents.find((x) => x.status === "ACTIVE") ?? d.documents[0];

  const preview = async () => {
    // Opened now, filled once the PDF arrives, so a pop-up blocker doesn't stop it.
    const tab = window.open("", "_blank");
    setBusy("preview");
    setError(null);
    try {
      const blob = await files.preview(quoteId, version);
      if (tab) {
        const url = URL.createObjectURL(blob);
        tab.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else saveBlob(blob, `PREVIEW-v${version}.pdf`);
    } catch (e) {
      tab?.close();
      setError({ what: "Couldn't open the preview.", cause: e });
    } finally {
      setBusy(null);
    }
  };

  const download = async (doc: DocumentView) => {
    setBusy(`download-${doc.id}`);
    setError(null);
    try {
      saveBlob(await files.download(quoteId, doc.id), doc.fileName);
    } catch (e) {
      setError({ what: "Couldn't download the order form.", cause: e });
    } finally {
      setBusy(null);
    }
  };

  const retryAttach = async (doc: DocumentView) => {
    setError(null);
    try {
      await attach.mutateAsync({ quoteId, documentId: doc.id });
      notify("Order form attached to Salesforce");
    } catch (e) {
      setError({ what: "Couldn't attach the order form to Salesforce.", cause: e });
    }
  };

  const confirmIssue = async () => {
    setError(null);
    try {
      await issue.mutateAsync({ quoteId, version });
      setConfirming(false);
      notify("Order form issued");
    } catch (e) {
      setError({ what: "Couldn't issue the order form.", cause: e });
      setConfirming(false);
    }
  };

  return (
    <SectionCard title="Order Form" icon={<FileTextIcon size={18} />}>
      {error ? (
        <ErrorNotice error={error.cause} sx={{ mb: 1.5 }}>
          {error.what}
        </ErrorNotice>
      ) : null}

      {active ? (
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Issued {formatDate(active.issueDate)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              {active.fileName}
            </Typography>
            <SalesforceLine
              doc={active}
              retrying={attach.isPending}
              onRetry={() => void retryAttach(active)}
            />
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadIcon size={16} />}
            onClick={() => void download(active)}
            disabled={busy !== null}
          >
            {busy === `download-${active.id}` ? "Downloading…" : "Download PDF"}
          </Button>
        </Stack>
      ) : d.canIssue ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Approved and ready to issue. Check the preview, then issue the order form to share it with the customer.
            Until then the quote can still be recalled and changed.
          </Typography>
          <Button variant="outlined" startIcon={<EyeIcon size={16} />} onClick={() => void preview()} disabled={busy !== null}>
            {busy === "preview" ? "Preparing preview…" : "Preview PDF"}
          </Button>
          <Button variant="contained" startIcon={<SendIcon size={16} />} onClick={() => setConfirming(true)} disabled={busy !== null}>
            Issue order form
          </Button>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Approved. The quote&apos;s owner issues the order form.
        </Typography>
      )}

      {hasSupporting ? (
        <>
          <Divider sx={{ my: 1.5 }} />
          <SupportingDocumentsSection quoteId={quoteId} readOnly={olderVersion} />
        </>
      ) : null}

      <Dialog open={confirming} onClose={() => !issue.isPending && setConfirming(false)} aria-labelledby="issue-title">
        <DialogTitle id="issue-title">Issue the order form?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              This produces the final order form for the customer and starts their acceptance period.
            </Typography>
            <Typography variant="body2">
              Issue date <strong>{formatDate(d.issueDate)}</strong> · expires <strong>{formatDate(d.expiryDate)}</strong>
            </Typography>
            {/* D122: issuing ends the chance to recall and change the quote. */}
            <Alert severity="warning">
              <strong>There&apos;s no going back.</strong> Once issued, this version can&apos;t be recalled or changed.
              Check the preview first: prices, terms, contacts and documents.
            </Alert>
            <Box>
              <Button size="small" startIcon={<EyeIcon size={16} />} onClick={() => void preview()} disabled={busy !== null || issue.isPending}>
                {busy === "preview" ? "Preparing preview…" : "Open the preview"}
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              If something is wrong after issuing, close this quote and clone it into a new one.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)} disabled={issue.isPending}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void confirmIssue()} disabled={issue.isPending}>
            {issue.isPending ? "Issuing…" : "Issue order form"}
          </Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
}

/** Where the order form stands in Salesforce (D111); nothing when it isn't for Salesforce. */
function SalesforceLine({ doc, retrying, onRetry }: { doc: DocumentView; retrying: boolean; onRetry: () => void }): JSX.Element | null {
  const at = doc.salesforceAt ? formatDateTime(doc.salesforceAt) : "";
  switch (doc.salesforceStatus) {
    case "ATTACHED":
      return (
        <Typography variant="caption" color="text.secondary" component="div">
          Attached to Salesforce · {at}
        </Typography>
      );
    case "REMOVED":
      return (
        <Typography variant="caption" color="text.secondary" component="div">
          Removed from Salesforce · {at}: another quote&apos;s order form replaced it
        </Typography>
      );
    case "NOT_ATTACHED":
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="warning.main">
            Not attached to Salesforce
          </Typography>
          {doc.canAttach ? (
            <Button size="small" onClick={onRetry} disabled={retrying}>
              {retrying ? "Attaching…" : "Retry"}
            </Button>
          ) : null}
        </Stack>
      );
    default:
      return null;
  }
}
