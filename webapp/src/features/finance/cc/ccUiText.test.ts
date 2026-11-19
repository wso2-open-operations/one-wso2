/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it } from "vitest";
import { CC_SNACK, describeReminderConfirmation, ruleWording } from "./ccUiText";

// Behaviour tests don't catch a reworded message, so these pin each one word for word.
describe("card-expense success messages keep their wording", () => {
  it.each([
    ["updateCardLabel", "Successfully updated the label"],
    ["saveEdit", "Successfully saved the edited transaction"],
    ["uploadAttachment", "Successfully uploaded the attachment"],
    ["removeAttachment", "Successfully removed the attachment"],
    ["submitTransaction", "Successfully submitted the transaction"],
    ["approveSubmission", "Successfully approved the submission"],
    ["processBankStatement", "Successfully processed the bank statement"],
    ["uploadNewTransactions", "Successfully saved the new transactions"],
  ] as const)("%s", (key, expected) => {
    expect(CC_SNACK.success[key]).toBe(expected);
  });

  it("has no messages beyond these", () => {
    // A new message is added here too, so it's added deliberately.
    expect(Object.keys(CC_SNACK.success).sort()).toEqual([
      "approveSubmission",
      "processBankStatement",
      "removeAttachment",
      "saveEdit",
      "submitTransaction",
      "updateCardLabel",
      "uploadAttachment",
      "uploadNewTransactions",
    ]);
  });
});

// The backend says "tagging rule", and "auto tagging rule" for a system rule; the UI says neither.
describe("ruleWording", () => {
  it.each([
    [
      "A tagging rule with the same card, supplier and account has an overlapping amount range.",
      "A rule with the same card, supplier and account has an overlapping amount range.",
    ],
    [
      "An auto tagging rule can't be deleted. It can be deactivated instead.",
      "A system rule can't be deleted. It can be deactivated instead.",
    ],
    [
      "The card, supplier and account of an auto tagging rule can't be changed.",
      "The card, supplier and account of a system rule can't be changed.",
    ],
    ["Insufficient privileges to create an auto-tagging rule.", "Insufficient privileges to create a system rule."],
    ["Error retrieving the tagging rules.", "Error retrieving the rules."],
    ["Tagging rule not found.", "Rule not found."],
    ["Bad supplier.", "Bad supplier."],
  ])("rewords %j", (server, shown) => {
    expect(ruleWording(server)).toBe(shown);
  });
});

// The dialog is the only thing between a click and an email that cannot be recalled,
// so what it says about the recipient and the window is pinned here.
describe("describeReminderConfirmation", () => {
  const lead = { leadName: "Yukthi Hewagamage", leadEmail: "yukthi@wso2.com" };

  it("names the lead and the date the window starts", () => {
    const { title, text } = describeReminderConfirmation(lead, "2026-05-19");
    expect(title).toBe("Send this reminder?");
    expect(text).toBe(
      "An email goes to Yukthi Hewagamage (yukthi@wso2.com) about unsubmitted transactions from " +
        "19 May 2026 onwards, copying the card holders with outstanding items.",
    );
  });

  it("says there is no lower bound when the period is All time", () => {
    const { text } = describeReminderConfirmation(lead);
    expect(text).toContain("every unsubmitted transaction on record");
    expect(text).not.toContain("onwards");
  });

  it("falls back to the email for a lead master data holds no name for", () => {
    const { text } = describeReminderConfirmation({ leadName: "", leadEmail: "yukthi@wso2.com" }, "2026-05-19");
    expect(text).toContain("An email goes to yukthi@wso2.com about");
    expect(text).not.toContain("()");
  });

  it("reads the date as a local one, not as UTC", () => {
    // A bare ISO date through `new Date(iso)` is UTC midnight, which is the day
    // before in any negative offset — the dialog would name the wrong start date.
    expect(describeReminderConfirmation(lead, "2026-01-01").text).toContain("01 Jan 2026");
  });

  it("always says the copied card holders are not listed here", () => {
    for (const dateFrom of ["2026-05-19", undefined]) {
      expect(describeReminderConfirmation(lead, dateFrom).text).toContain(
        "copying the card holders with outstanding items",
      );
    }
  });
});
