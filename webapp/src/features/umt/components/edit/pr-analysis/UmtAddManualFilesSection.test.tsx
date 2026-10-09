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

// A rejected zip must not upload anything, including entries that were already
// unpacked before a later entry failed a check.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";

const state = vi.hoisted(() => ({
  uploadMutate: vi.fn(async () => undefined),
  showError: vi.fn(),
}));

vi.mock("../../../api/useUmtPrAnalysis", () => ({
  useUmtUploadPullRequestAnalysisFile: () => ({ isPending: false, mutateAsync: state.uploadMutate }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: state.showError, showWarning: vi.fn() }),
}));

const { default: UmtAddManualFilesSection } = await import("./UmtAddManualFilesSection");

/** Builds zip bytes from name-to-content pairs. */
async function zipBytes(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Overwrites every entry's declared uncompressed size, the way a forged archive would. */
function forgeDeclaredSizes(bytes: Uint8Array, size: number): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i + 4 <= bytes.length; i++) {
    const signature = view.getUint32(i, true);
    if (signature === 0x04034b50) view.setUint32(i + 22, size, true);
    else if (signature === 0x02014b50) view.setUint32(i + 24, size, true);
  }
  return bytes;
}

/** Wraps zip bytes in a File, as picked in the dialog. */
function zipFile(bytes: Uint8Array): File {
  return new File([bytes as BlobPart], "patch.zip");
}

/** Opens the Add Manual File dialog, fills it in for `file` and clicks Add. */
async function addZip(file: File) {
  const onFilesChange = vi.fn();
  render(
    <UmtAddManualFilesSection
      updateId="1"
      disabled={false}
      files={[]}
      onFilesChange={onFilesChange}
      bundlesInfoChanges={[]}
      onBundlesInfoChanged={vi.fn()}
      onDirty={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Add manual file" }));
  await userEvent.type(screen.getByLabelText("Path in Product Pack"), "repository/components/dropins");
  await userEvent.click(screen.getByRole("combobox", { name: "Operation" }));
  await userEvent.click(screen.getByRole("option", { name: "Added" }));
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
    target: { files: [file] },
  });
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  return { onFilesChange };
}

describe("UmtAddManualFilesSection zip uploads", () => {
  beforeEach(() => {
    state.uploadMutate.mockClear();
    state.showError.mockClear();
  });

  it("uploads every entry of a valid zip", async () => {
    const { onFilesChange } = await addZip(zipFile(await zipBytes({ "a.jar": "alpha", "lib/b.jar": "beta" })));

    await waitFor(() => expect(onFilesChange).toHaveBeenCalled());
    expect(state.uploadMutate).toHaveBeenCalledTimes(2);
  });

  it("uploads nothing when a zip contains an unsafe entry path", async () => {
    const { onFilesChange } = await addZip(zipFile(await zipBytes({ "a.jar": "alpha", "lib/../../evil.jar": "bad" })));

    expect(await screen.findByText(/"lib\/\.\.\/\.\.\/evil\.jar" is not a safe path/)).toBeInTheDocument();
    expect(state.uploadMutate).not.toHaveBeenCalled();
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it("uploads nothing when a later entry fails a limit after earlier entries were unpacked", async () => {
    // Every entry declares 10 bytes: the first really is 10 bytes and unpacks
    // fine, the second is 3 MB and is stopped by the running byte count.
    const forged = forgeDeclaredSizes(
      await zipBytes({ "a.jar": "0123456789", "bomb.jar": new Uint8Array(3 * 1024 * 1024) }),
      10,
    );
    const { onFilesChange } = await addZip(zipFile(forged));

    expect(await screen.findByText(/"bomb\.jar" is larger than 2 MB when unzipped/)).toBeInTheDocument();
    expect(state.uploadMutate).not.toHaveBeenCalled();
    expect(onFilesChange).not.toHaveBeenCalled();
  });
});
