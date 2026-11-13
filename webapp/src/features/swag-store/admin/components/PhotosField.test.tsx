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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fetchWithReauth = vi.hoisted(() => vi.fn());
const preparePhoto = vi.hoisted(() => vi.fn());

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "admin" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  fetchWithReauth,
}));
vi.mock("../../util/photoResize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../util/photoResize")>()),
  preparePhoto,
}));

import type { SwagStoreProductImage } from "../../api/swagStoreTypes";
import { photo } from "../../testing/fixtures";
import { PhotoPrepError } from "../../util/photoResize";
import PhotosField from "./PhotosField";

const PRODUCT = "0192f3a4-0000-7000-8000-0000000000d1";
const png = (name = "back.png") => new File(["png"], name, { type: "image/png" });

/** The editor keeps the photo list in its form state; this stands in for it. */
function Harness({ productId = PRODUCT, initial = [photo("front")] }: { productId?: string; initial?: SwagStoreProductImage[] }) {
  const [images, setImages] = useState<readonly SwagStoreProductImage[]>(initial);
  return (
    <>
      <PhotosField productId={productId || undefined} productName="WSO2 Hoodie" images={images} onChange={setImages} />
      <output data-testid="saved">{JSON.stringify(images.map((i) => [i.view, i.path, i.alt]))}</output>
    </>
  );
}

function renderField(props: Parameters<typeof Harness>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

const slot = (label: string) => screen.getByRole("group", { name: `${label} photo` });
const fileInput = (label: string) => screen.getByLabelText(`${label} photo file`) as HTMLInputElement;
const saved = () => JSON.parse(screen.getByTestId("saved").textContent ?? "[]") as [string, string, string][];
const stored = (view: string, path = `products/${PRODUCT}/${view}-0a1b2c3d.webp`) =>
  new Response(JSON.stringify({ view, path, url: `https://acc.blob.core.windows.net/c/${path}?sig=n` }), { status: 201 });
const failure = (status: number, body: object) => new Response(JSON.stringify(body), { status });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  fetchWithReauth.mockReset();
  preparePhoto.mockReset();
  preparePhoto.mockImplementation(async (f: File) => f);
});

afterEach(() => vi.restoreAllMocks());

describe("PhotosField", () => {
  it("shows one slot per view in gallery order, with Front as the main photo", () => {
    renderField();
    const names = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(names).toEqual([
      "Front photo",
      "Back photo",
      "Left side photo",
      "Right side photo",
      "Top photo",
      "Bottom photo",
      "Detail 1 photo",
      "Detail 2 photo",
      "Detail 3 photo",
      "Detail 4 photo",
    ]);
    expect(within(slot("Front")).getByText("Main photo")).toBeInTheDocument();
    expect(within(slot("Front")).getByRole("img", { name: "WSO2 Hoodie, Front" })).toBeInTheDocument();
    expect(within(slot("Front")).getByRole("button", { name: "Replace Front photo" })).toBeEnabled();
    expect(within(slot("Back")).getByRole("button", { name: "Upload Back photo" })).toBeEnabled();
    expect(screen.getByText("JPEG, PNG or WebP. Large photos are scaled down to 1600 px. Square photos look best.")).toBeInTheDocument();
  });

  it("scales, then uploads into an empty slot and shows the photo", async () => {
    const user = userEvent.setup();
    const scaled = new File(["webp"], "back.webp", { type: "image/webp" });
    const prep = deferred<File>();
    const sent = deferred<Response>();
    preparePhoto.mockReturnValueOnce(prep.promise);
    fetchWithReauth.mockReturnValueOnce(sent.promise);
    renderField();

    await user.upload(fileInput("Back"), png());
    expect(await within(slot("Back")).findByText("Preparing…")).toBeInTheDocument();
    expect(within(slot("Back")).getByRole("button", { name: "Upload Back photo" })).toBeDisabled();
    expect(within(slot("Top")).getByRole("button", { name: "Upload Top photo" })).toBeEnabled();

    prep.resolve(scaled);
    expect(await within(slot("Back")).findByText("Uploading…")).toBeInTheDocument();
    const form = fetchWithReauth.mock.calls[0][1].body as FormData;
    expect([form.get("view"), (form.get("file") as File).name]).toEqual(["back", "back.webp"]);

    sent.resolve(stored("back"));
    expect(await within(slot("Back")).findByRole("img", { name: "WSO2 Hoodie, Back" })).toBeInTheDocument();
    expect(saved().map(([view]) => view)).toEqual(["front", "back"]);
    expect(within(slot("Back")).getByRole("button", { name: "Replace Back photo" })).toBeEnabled();
  });

  it("refuses a HEIC or a 30 MB file without sending it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderField();
    await user.upload(fileInput("Back"), new File(["x"], "IMG_0001.heic", { type: "image/heic" }));
    expect(within(slot("Back")).getByText("Use a JPEG, PNG or WebP photo.")).toBeInTheDocument();
    const huge = png("huge.png");
    Object.defineProperty(huge, "size", { value: 30 * 1024 * 1024 });
    await user.upload(fileInput("Top"), huge);
    expect(within(slot("Top")).getByText("Photos are at most 25 MB.")).toBeInTheDocument();
    expect(preparePhoto).not.toHaveBeenCalled();
    expect(fetchWithReauth).not.toHaveBeenCalled();
  });

  it("shows why a photo couldn't be scaled", async () => {
    const user = userEvent.setup();
    preparePhoto.mockRejectedValueOnce(new PhotoPrepError("This photo couldn't be read. Try another file."));
    renderField();
    await user.upload(fileInput("Back"), png());
    expect(await within(slot("Back")).findByText("This photo couldn't be read. Try another file.")).toBeInTheDocument();
    expect(fetchWithReauth).not.toHaveBeenCalled();
  });

  it("uploads the same file again after Remove", async () => {
    const user = userEvent.setup();
    fetchWithReauth.mockResolvedValueOnce(stored("back")).mockResolvedValueOnce(stored("back", `products/${PRODUCT}/back-11111111.png`));
    renderField();
    const file = png();
    await user.upload(fileInput("Back"), file);
    await within(slot("Back")).findByRole("button", { name: "Replace Back photo" });
    expect(fileInput("Back").value).toBe(""); // cleared, so picking the same file fires again
    await user.click(within(slot("Back")).getByRole("button", { name: "Remove Back photo" }));
    expect(saved().map(([view]) => view)).toEqual(["front"]);
    await user.upload(fileInput("Back"), file);
    await waitFor(() => expect(saved().map(([view]) => view)).toEqual(["front", "back"]));
    expect(fetchWithReauth).toHaveBeenCalledTimes(2);
  });

  it("edits a photo's description", async () => {
    const user = userEvent.setup();
    renderField();
    const alt = within(slot("Front")).getByRole("textbox", { name: "Front description" });
    expect(alt).toHaveAttribute("placeholder", "WSO2 Hoodie, Front");
    await user.type(alt, "Logo print");
    expect(saved()[0][2]).toBe("Logo print");
  });

  it("shows the removed-product message on 409", async () => {
    const user = userEvent.setup();
    fetchWithReauth.mockResolvedValueOnce(
      failure(409, { message: "This product was removed. Restore it to change its photos.", errorCode: "state_conflict" }),
    );
    renderField();
    await user.upload(fileInput("Back"), png());
    expect(await within(slot("Back")).findByText("This product was removed. Restore it to change its photos.")).toBeInTheDocument();
    expect(saved().map(([view]) => view)).toEqual(["front"]);
  });

  it("turns every slot off when photos aren't set up", async () => {
    const user = userEvent.setup();
    fetchWithReauth.mockResolvedValueOnce(failure(503, { message: "m", errorCode: "assets_not_configured" }));
    renderField();
    await user.upload(fileInput("Back"), png());
    expect(await screen.findByText("Photos aren't set up in this environment.")).toBeInTheDocument();
    for (const name of ["Replace Front photo", "Upload Back photo", "Upload Detail 4 photo"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("waits for the first save on a new product", () => {
    renderField({ productId: "", initial: [] });
    expect(screen.getByText("Save the draft to add photos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Front photo" })).toBeDisabled();
  });
});
