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
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  FileUpIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { CC_SNACK } from "../ccCopy";
import { CcStatementUploadDialog } from "../CcStatementUploadDialog";
import { CcStatementGrid } from "../CcStatementGrid";
import { CcNoStatementArt } from "../components/CcNoStatementArt";
import { useCcProcessStatement, useCcUploadTransactions } from "../useCcMutations";
import { useCcUserInfo } from "../useCc";
import { ccHasAccess, type CcBankCode, type CcTransactionUploadGroup } from "../ccTypes";
import { FINANCE_EYEBROW } from "@constants/financeApps";

type TabKey = "new" | "duplicate" | "invalid";

// index.tsx:190-210 — one tab per group, each with the icon and the status
// colour the source gives it: new is a success, a duplicate is a warning, an
// invalid row is an error. The port had three plain text tabs, so which of
// them wanted attention was something you had to read rather than see.
const TABS: readonly {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  color: "success" | "warning" | "error";
}[] = [
  { key: "new", label: "New", icon: CircleCheckIcon, color: "success" },
  { key: "duplicate", label: "Duplicate", icon: TriangleAlertIcon, color: "warning" },
  { key: "invalid", label: "Invalid", icon: CircleAlertIcon, color: "error" },
];

function rowsFor(group: CcTransactionUploadGroup, key: TabKey) {
  if (key === "new") return group.newItems;
  if (key === "duplicate") return group.duplicateItems;
  return group.invalidItems;
}

export default function CcSettingsPage() {
  const userInfo = useCcUserInfo();
  const process = useCcProcessStatement();
  const upload = useCcUploadTransactions();
  const { showSuccess, showError } = useNotifications();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bank, setBank] = useState<CcBankCode>("svb");
  // The file as chosen, so the dialog can show its name and size before it is
  // sent anywhere.
  const [chosen, setChosen] = useState<File | null>(null);
  // The bank code + file name are captured at parse time and kept WITH the
  // parsed group, so changing the bank Select afterwards can't make Save
  // post the group under a different bankCode than it was parsed with.
  const [parsed, setParsed] = useState<
    { group: CcTransactionUploadGroup; bankCode: CcBankCode; fileName: string } | null
  >(null);
  const [tab, setTab] = useState<TabKey>("new");

  const group = parsed?.group ?? null;
  const isFinance = ccHasAccess(userInfo.data, "finance");
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  // :288-292 — closing puts the dialog back how it was found, the stale parse
  // failure included, so reopening it doesn't lead with the last attempt's
  // error message.
  const closeDialog = () => {
    if (process.isPending) return;
    setDialogOpen(false);
    setChosen(null);
    process.reset();
  };

  // A parse failure describes one file parsed as one bank. Change either and
  // the Alert is reporting an attempt that no longer matches what is on
  // screen — the wrong file's error sitting beside the right file, with
  // nothing saying it is stale. `mutate` clears it too, but only once Upload
  // is pressed, which is a whole interaction too late.
  const forgetParseError = () => {
    if (process.isError) process.reset();
  };

  // :57-70 — picking a file does not send it; Upload does.
  const handleUpload = () => {
    if (!chosen) return;
    const bankCode = bank;
    const fileName = chosen.name;
    process.mutate(
      { bankCode, fileName, file: chosen },
      {
        onSuccess: (g) => {
          showSuccess(CC_SNACK.success.processBankStatement);
          setParsed({ group: g, bankCode, fileName });
          setTab("new");
          setDialogOpen(false);
        },
        // No snackbar: the source reports a parse failure inside the dialog
        // (:262-266), which is where the file that caused it still is and
        // where it can be swapped for another one. `process.isError` drives
        // that Alert, so saying it twice would just be noise.
      },
    );
  };

  const handleSave = () => {
    if (!parsed) return;
    upload.mutate(
      { bankCode: parsed.bankCode, fileName: parsed.fileName, group: parsed.group },
      {
        onSuccess: () => {
          showSuccess(CC_SNACK.success.uploadNewTransactions);
          setParsed(null);
          // And the file itself, or reopening the dialog would show a
          // statement that has already been saved as though it were still
          // waiting to be sent.
          setChosen(null);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const discard = () => {
    setParsed(null);
    setChosen(null);
  };

  // :112-165 — which actions the page offers depends on whether there is a
  // parsed statement on screen: before one, the way in; after one, the two
  // ways out of it.
  //
  // They sit in a row of their own at the top of the page rather than on the
  // title's line, where the source puts them. Putting them on the title's line
  // would mean an `actions` slot on FinanceShell — a component OPD and Expense
  // share — and this screen is not worth reshaping the other two apps' page
  // frame for.
  const actions =
    userInfo.isLoading || !isFinance ? null : group ? (
      <>
        <Button variant="outlined" size="large" onClick={discard} disabled={upload.isPending}>
          Cancel
        </Button>
        {/* :143-163 — a disabled Save says why it is disabled. */}
        <Tooltip title={group.newItems.length === 0 ? "No new items to save" : ""}>
          <span>
            <Button
              variant="contained"
              size="large"
              onClick={handleSave}
              disabled={group.newItems.length === 0 || upload.isPending}
              startIcon={
                upload.isPending ? <CircularProgress size={18} color="inherit" /> : undefined
              }
            >
              Save
            </Button>
          </span>
        </Tooltip>
      </>
    ) : (
      <Button
        variant="contained"
        size="large"
        startIcon={<FileUpIcon size={18} />}
        onClick={() => setDialogOpen(true)}
      >
        Upload Statement
      </Button>
    );

  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Bank Statement Upload"
      subtitle="Upload a bank statement CSV and save its new transactions as pending submissions."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
    >
      {actions && (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 2 }}>
          {actions}
        </Stack>
      )}

      {userInfo.isLoading ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : !isFinance ? (
        <Alert severity="info">Statement ingestion is limited to finance approvers.</Alert>
      ) : group ? (
        <ParsedStatement group={group} tab={tab} active={active} onTab={setTab} />
      ) : (
        <NoStatementYet />
      )}

      {/* Mounted whatever is on screen behind it, so the dialog's own state —
          the chosen file, the bank, a parse in flight — isn't thrown away and
          rebuilt each time it opens. */}
      <CcStatementUploadDialog
        open={dialogOpen}
        bank={bank}
        file={chosen}
        pending={process.isPending}
        error={process.isError ? describeError(process.error) : null}
        onBankChange={(b) => {
          forgetParseError();
          setBank(b);
        }}
        onPick={(f) => {
          forgetParseError();
          setChosen(f);
        }}
        onClearFile={() => {
          forgetParseError();
          setChosen(null);
        }}
        onUpload={handleUpload}
        onClose={closeDialog}
      />
    </FinanceShell>
  );
}

// NoDataPlaceHolder.tsx — a bordered panel filling what is left of the page,
// with the drawing and the two lines centred in it. index.tsx:232-236 supplies
// the wording.
function NoStatementYet() {
  return (
    <Box
      sx={{
        // As tall as the room actually left below the title, rather than a
        // fixed height: a fixed one either leaves a short panel floating in a
        // tall window, or overshoots a short window and puts a scrollbar on a
        // screen that has nothing to scroll to. The subtraction covers the app
        // bar, the footer, the scroller's own padding, the title block and the
        // actions row; the floor keeps it sane if the window is tiny.
        //
        // `calc` rather than flex because FinanceShell does not make this a
        // flex column — that is its `fill` prop, which this screen deliberately
        // does not use so it stays independent of the other finance apps.
        minHeight: "max(380px, calc(100vh - 340px))",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        p: 3,
        textAlign: "center",
      }}
    >
      <CcNoStatementArt height={200} />
      <Typography sx={{ fontSize: 18, fontWeight: 600, color: "text.secondary" }}>
        Upload a bank statement
      </Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>
        Upload a statement to view transactions
      </Typography>
    </Box>
  );
}

function ParsedStatement({
  group,
  tab,
  active,
  onTab,
}: {
  group: CcTransactionUploadGroup;
  tab: TabKey;
  active: (typeof TABS)[number];
  onTab: (key: TabKey) => void;
}) {
  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_e, v) => onTab(v as TabKey)}
        aria-label="Parsed statement groups"
        sx={{
          mb: 2,
          // :173-189 — the indicator and the selected label take the colour of
          // the group being looked at, so the screen says at a glance whether
          // you are in the good rows or the bad ones.
          "& .MuiTabs-indicator": { backgroundColor: `${active.color}.main` },
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            minHeight: 48,
            "&.Mui-selected": { color: `${active.color}.main` },
          },
        }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.key}
            value={t.key}
            icon={<t.icon size={18} />}
            iconPosition="start"
            id={`cc-statement-tab-${t.key}`}
            aria-controls="cc-statement-tabpanel"
            label={`${t.label} (${rowsFor(group, t.key).length})`}
          />
        ))}
      </Tabs>

      <Box
        role="tabpanel"
        id="cc-statement-tabpanel"
        aria-labelledby={`cc-statement-tab-${tab}`}
      >
        <CcStatementGrid rows={rowsFor(group, tab)} />
      </Box>
    </Box>
  );
}
