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

import { HttpError } from "@api/http";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CcTaggingRule } from "./ccTypes";

const rule = {
  id: 7,
  creditCardId: 10,
  ccNumber: "123456",
  employeeEmail: "jane@wso2.com",
  supplier: "Uber",
  account: "acc-1",
  amountMin: null,
  amountMax: null,
  expenseCategoryLabel: null,
  expenseTypeLabel: null,
  comment: null,
  subRegion: null,
  productUnit: null,
  businessUnit: null,
  source: "manual",
  active: true,
  outdated: false,
} satisfies CcTaggingRule;

const deleted: number[] = [];
const server = { fail: null as Error | null, pending: false };

vi.mock("./useCcMutations", async () => {
  const { useState } = await vi.importActual<typeof import("react")>("react");
  return {
    useCcDeleteTaggingRule: () => {
      const [error, setError] = useState<Error | null>(null);
      return {
        mutate: (id: number, opts?: { onSuccess?: () => void }) => {
          deleted.push(id);
          if (server.fail) {
            setError(server.fail);
            return;
          }
          opts?.onSuccess?.();
        },
        isPending: server.pending,
        isError: Boolean(error),
        error,
      };
    },
  };
});

const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");
const { CcTaggingRuleDeleteDialog } = await import("./CcTaggingRuleDeleteDialog");

const onClose = vi.fn();
const open = () =>
  render(
    <NotificationsProvider>
      <CcTaggingRuleDeleteDialog rule={rule} onClose={onClose} />
    </NotificationsProvider>,
  );

beforeEach(() => {
  deleted.length = 0;
  server.fail = null;
  server.pending = false;
  vi.clearAllMocks();
});

describe("CcTaggingRuleDeleteDialog", () => {
  it("names the rule it deletes", () => {
    open();
    expect(screen.getByRole("dialog")).toHaveTextContent("Uber");
    expect(screen.getByRole("dialog")).toHaveTextContent("123456");
  });

  it("deletes the rule, says so and closes", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleted).toEqual([7]);
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText("Rule deleted")).toBeInTheDocument();
  });

  it("keeps the delete dialog open on an error, with the reason inside", async () => {
    const body = JSON.stringify({ message: "Tagging rule not found." });
    server.fail = new HttpError("https://cc.test/tagging-rules/7", 404, body);
    open();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Rule not found.");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/tagging/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("can't be dismissed while the delete runs", () => {
    server.pending = true;
    open();

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
