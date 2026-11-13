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

// The Add Product dialog: what it refuses to submit, and what it says about it.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpError } from "@api/http";

const createProduct = vi.hoisted(() => ({
  mutateAsync: vi.fn<(request: unknown) => Promise<void>>(async () => undefined),
}));

vi.mock("../api/useUmtProducts", () => ({
  useUmtCreateProduct: () => ({ isPending: false, mutateAsync: createProduct.mutateAsync, reset: () => {} }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const { default: UmtAddProductDialog } = await import("../components/UmtAddProductDialog");

function fillForm(version: string) {
  const entries: [RegExp, string][] = [
    [/Product Name/, "wso2am"],
    [/Product Version/, version],
    [/Lead Email/, "lead@wso2.com"],
    [/ED Email/, "ed@wso2.com"],
    [/FTP Host/, "ftp.wso2.com"],
    [/FTP Port/, "22"],
    [/FTP Username/, "uploader"],
    [/FTP Password/, "secret"],
    [/FTP Absolute Path/, "/updates"],
  ];
  for (const [label, value] of entries) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

beforeEach(() => {
  // mockReset, not mockClear: it also drops a queued mockRejectedValueOnce
  // that a test left unused, and goes back to the default success.
  createProduct.mutateAsync.mockReset();
});

describe("Add Product dialog", () => {
  it("does not submit a version that is not X.Y.Z, and asks for that format", async () => {
    render(<UmtAddProductDialog open onClose={() => {}} />);
    fillForm("4.0.0.1");

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Use the X.Y.Z format, for example 4.0.0.")).toBeInTheDocument();
    expect(createProduct.mutateAsync).not.toHaveBeenCalled();
  });

  describe("a lead or ED email", () => {
    const emailMessage = () => screen.queryAllByText("Enter a valid email address.");

    it.each([/Lead Email/, /ED Email/])("is called out as it is typed when it is malformed (%s)", (label) => {
      render(<UmtAddProductDialog open onClose={() => {}} />);

      fireEvent.change(screen.getByLabelText(label), { target: { value: "not-an-email" } });

      expect(emailMessage()).toHaveLength(1);
      expect(screen.getByLabelText(label)).toBeInvalid();
    });

    it("says nothing while it is empty or well formed, and stops once a malformed one is corrected", () => {
      render(<UmtAddProductDialog open onClose={() => {}} />);
      expect(emailMessage()).toHaveLength(0);

      fireEvent.change(screen.getByLabelText(/Lead Email/), { target: { value: "lead@wso2..com" } });
      expect(emailMessage()).toHaveLength(1);

      fireEvent.change(screen.getByLabelText(/Lead Email/), { target: { value: "lead@wso2.com" } });
      expect(emailMessage()).toHaveLength(0);
    });

    it("keeps the form from submitting", async () => {
      render(<UmtAddProductDialog open onClose={() => {}} />);
      fillForm("4.2.0");
      fireEvent.change(screen.getByLabelText(/ED Email/), { target: { value: "ed@" } });

      await userEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(emailMessage()).toHaveLength(1);
      expect(createProduct.mutateAsync).not.toHaveBeenCalled();
    });
  });

  it("submits an X.Y.Z version", async () => {
    render(<UmtAddProductDialog open onClose={() => {}} />);
    fillForm("4.2.0");

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createProduct.mutateAsync).toHaveBeenCalledTimes(1));
    expect(createProduct.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ version: "4.2.0.0.full" }));
  });

  describe("an FTP port", () => {
    const portMessage = () => screen.queryAllByText("Enter a port number from 1 to 65535.");

    it.each(["ftp", "21/tcp", "0", "65536", "-21"])("is called out as it is typed when it is not a port (%s)", (port) => {
      render(<UmtAddProductDialog open onClose={() => {}} />);

      fireEvent.change(screen.getByLabelText(/FTP Port/), { target: { value: port } });

      expect(portMessage()).toHaveLength(1);
      expect(screen.getByLabelText(/FTP Port/)).toBeInvalid();
    });

    it("keeps the form from submitting", async () => {
      render(<UmtAddProductDialog open onClose={() => {}} />);
      fillForm("4.2.0");
      fireEvent.change(screen.getByLabelText(/FTP Port/), { target: { value: "ftp" } });

      await userEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(portMessage()).toHaveLength(1);
      expect(createProduct.mutateAsync).not.toHaveBeenCalled();
    });
  });

  it("sends the FTP details under the backend's keys, and no platform when none is picked", async () => {
    render(<UmtAddProductDialog open onClose={() => {}} />);
    fillForm("4.2.0");

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createProduct.mutateAsync).toHaveBeenCalledTimes(1));
    const request = createProduct.mutateAsync.mock.calls[0][0];
    expect(request).toEqual(
      expect.objectContaining({
        FTPHost: "ftp.wso2.com",
        FTPPort: "22",
        FTPUsername: "uploader",
        FTPPassword: "secret",
        FTPPath: "/updates",
      }),
    );
    expect(request).not.toHaveProperty("platform");
  });

  it("sends the picked platform", async () => {
    render(<UmtAddProductDialog open onClose={() => {}} />);
    fillForm("4.2.0");

    await userEvent.click(screen.getByRole("combobox", { name: /Platform/ }));
    await userEvent.click(await screen.findByRole("option", { name: "IAM Platform" }));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createProduct.mutateAsync).toHaveBeenCalledTimes(1));
    expect(createProduct.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ platform: "IAM" }));
  });

  it("shows a JSON-wrapped backend message as plain text", async () => {
    const body = JSON.stringify({ error: { code: 400, message: JSON.stringify({ message: "Product already exists" }) } });
    createProduct.mutateAsync.mockRejectedValueOnce(new HttpError("/update/product", 400, body));
    render(<UmtAddProductDialog open onClose={() => {}} />);
    fillForm("4.2.0");

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Product already exists")).toBeInTheDocument();
  });
});
