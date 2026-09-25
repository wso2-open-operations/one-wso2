# Banking — what was ported and how it works

The employee-facing part of the banking app (`digiops-hr/apps/banking`), moved
into One WSO2 as a **Banking** page under **Me**, at `/me/banking`.

## 1. What it is for

Employees keep up to three bank accounts on record, one for each kind of
payment:

- **Salary** — where the salary is paid.
- **Consultancy** — where consultancy payments are made. Not everyone has this;
  people in certain roles never see it.
- **Reimbursement** — where expense reimbursements are paid. Only available to
  employees in certain countries.

The page lets an employee see their current account of each kind, ask for a
change, and look back at everything they have asked for before.

What the page does not cover: the parts of the old app used by HR and Finance
staff (approving or rejecting requests, reports, employee operations, managing
the bank list, changing the cutoff days). Those are not ported yet. The page is
laid out in tabs so they can be added later.

## 2. The screens

### 2.1 My Accounts

Three panels side by side: Salary, Consultancy, Reimbursement. Each panel shows
the employee's **current** account of that kind, and has an Edit button. A kind
the employee has no account for still shows its full list of fields, filled
with dashes.

| Panel | Fields shown |
|---|---|
| Salary | Account holder's name and address, account number, bank location, bank name, swift code, bank code, branch name, bank address |
| Consultancy | Account holder's name and address, bank name, account number, payment method, effective month |
| Reimbursement | Account holder's name and address, account number, bank location, bank name, swift code, bank code |

Under the panels, one banner tells the employee the last day of the month on
which Salary and Consultancy changes can still be made.

### 2.2 The change dialog (Edit button)

Three steps. Nothing is saved until the last one is confirmed, and the form
always starts empty, even when an account already exists.

1. **Account Holder Info** — name, address, country, account number.
2. **Bank Info** — bank location, then the bank (name and swift code), bank
   code (filled in automatically, cannot be edited), bank address, and — for
   Salary and Reimbursement only — branch name and branch code.
3. **Finish** — everything entered, grouped for a last read-through. Pressing
   Save asks "Are you sure you want to make this bank account change?"; only
   Yes sends it.

If the request is refused, the reason from the banking system is shown in the
dialog and the employee can go back and fix it. If it works, the dialog closes
and a message names the kind of account that was requested.

### 2.3 Summary

A table of every change the employee has ever asked for, for all three kinds
and every status (Active, Requested, Rejected, Inactive), newest first. Columns:
account type, effective from, account number, name, changed bank, payment
method (shown as Bank Transfer when a record has none) and status. Any column
can be clicked to sort (click again to reverse, again to go back to the
original order). Rows come in pages of 7, 10, 25 or 50.

Both tabs read the latest data every time they are opened.

## 3. The rules

### 3.1 Monthly cutoff (Salary and Consultancy)

Each of these two has a last day of the month by which a change may be asked
for. The days are set in the banking system (the staging values were 20 for
Salary and 30 for Consultancy). The day itself is still allowed; the day after
is not. After the cutoff the Edit button is disabled and says why. The day is
worked out in UTC, not in the employee's own time zone, so the answer near
midnight is the same for everyone.

### 3.2 Reimbursement is for some countries only

The banking system holds a list of allowed countries. If the employee's work
location is not exactly on that list, Reimbursement's Edit button is disabled
and says so. Reimbursement has no cutoff day.

### 3.3 Consultancy is hidden for some roles

The banking system also holds a list of roles that may not use Consultancy.
Someone in one of them does not see the Consultancy panel at all.

### 3.4 What the forms check

- Every required field must have something in it. A field holding only spaces
  counts as filled in, exactly as in the old app.
- **Addresses** (account holder's and bank's) must have at least three parts
  separated by commas, for example `No 23, Galle Road, Colombo`.
- **Account number** — at most 34 characters.
- **Country** must be picked from the list.
- **Bank** — picking a different bank clears the bank address, since the address
  belonged to the previous one. Picking a different bank location clears the
  chosen bank.
- Where the location is `US`, banks are looked up under "United States".

### 3.5 Consultancy bank location

For Consultancy, the bank location choices are narrowed. The banking system can
list, for an employee's work location, which countries they may choose; without
a listing the only choice is their own work location. The dialog starts with the
work location selected when it is allowed, otherwise with the first allowed one.
If the employee's own location is not among the choices, a short notice says
"Your country is not available in the bank locations."

### 3.6 What happens after a request

- **Salary** — becomes a pending request. The current account stays in place
  until an administrator approves it.
- **Reimbursement and Consultancy** — take effect immediately and replace the
  old account.

The banking system also refuses some requests, and its reason is shown: for
example when a Salary change is already pending, when the new details match the
current account, when the name is too long, or when the cutoff has passed.

## 4. Where the data comes from

Everything comes from the banking system, as in the old app. Only the sign-in
itself supplies the employee's email and group memberships.

| What | Banking system address |
|---|---|
| The employee's accounts (and the history) | `GET /employee/accounts` |
| Cutoff days, allowed countries, restricted roles, country list, location listings | `GET /app-config` |
| List of banks | `GET /banks` |
| The employee's own record, for their work location | `GET /employee-info` |
| Send a change request | `POST /employee/accounts` |
| Whether this person may use Banking | `GET /employee-privileges` |

The request that is sent carries the account details plus the account holder's
country (the banking system requires it), today's date as the effective date,
and empty branch fields for Consultancy.

## 5. Who can open the page

Only people the banking system says are employees see the Banking entry in the
menu, the page itself, and the Edit link on the overview page's Bank Accounts
card. Everyone else is sent back to the Me page if they type the address.

If the banking system does not have that check yet, the page is shown to
everyone, so the order in which the two are released does not matter. The
banking system still checks every request itself, so this only decides what is
worth showing.

## 6. When something goes wrong

| Situation | What the employee sees |
|---|---|
| No banking system address is set up | "Not configured", with the setting to change |
| The settings cannot be loaded | Edit buttons are disabled with "Couldn't load banking configuration." |
| The employee's record cannot be loaded | A message with a Retry button |
| Accounts cannot be loaded | A message with a Retry button |
| No history yet | "No account history found" |

## 7. Differences from the old app, on purpose

- No "Employee Details" strip above the panels; My Profile already shows it.
- The dialog also closes when clicking outside it or pressing Esc.
- Summary can be sorted and paged but does not have the old grid's Columns,
  Filters, Density and Export buttons.
- When the settings cannot be loaded the old app quietly assumes the 1st of the
  month; here the buttons are disabled and say why.
- The old app shows no message for a missing bank location or bank; here one
  is shown, in the old app's own words, instead of silently refusing to continue.
- The old app kept a stale bank selected after changing the bank location; here
  it is cleared.
- Who may open the page is decided by the banking system (section 5) instead of
  a group name kept in this app's own settings.

## 8. Things to know before testing

- **Saving a real change is not a dry run.** A Salary request sends the employee
  an email. Reimbursement and Consultancy also update NetSuite. Use an account
  where that is acceptable.
- The cutoff day, allowed countries and restricted roles are settings in the
  banking system; to see a disabled button, change the setting or pick a day
  past the cutoff.
- The work location shown to the rules is the banking system's own record. Some
  records use an abbreviation or a suffix (for example `US`, or a role after the
  country); those are matched exactly, as in the old app.

## 9. Test checklist

- [ ] Menu shows Banking; the page opens with three panels and both tabs.
- [ ] A kind with no account shows its fields as dashes.
- [ ] After the Salary cutoff day, Salary's Edit is disabled and says why; the
      banner shows both cutoff days.
- [ ] An employee outside the allowed countries has Reimbursement's Edit disabled.
- [ ] Someone in a restricted role does not see Consultancy.
- [ ] Each step of the dialog refuses empty required fields with the right message.
- [ ] An address with fewer than three comma-separated parts is refused.
- [ ] Save asks for confirmation; No or Cancel sends nothing.
- [ ] A refused request shows the reason and keeps the dialog open.
- [ ] After a Reimbursement or Consultancy request the panel shows the new
      account; after a Salary request it still shows the old one.
- [ ] Summary lists all statuses, sorts by each column, and pages.
- [ ] Opening either tab loads fresh data.
- [ ] Someone who is not an employee does not see the menu entry and is sent
      back to Me when typing the address.
