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

import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_PHOTO_BYTES } from "./photos";
import { fitWithin, needsScaling, outputType, PhotoPrepError, preparePhoto } from "./photoResize";

describe("fitWithin", () => {
  it("fits within 1600 without cropping or enlarging", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 10, 1600)).toEqual({ width: 1600, height: 2 });
    expect(fitWithin(100000, 10, 1600)).toEqual({ width: 1600, height: 1 }); // never 0
  });
});

describe("needsScaling", () => {
  it("scales only photos over 1600 px or over 5 MB", () => {
    expect(needsScaling({ width: 1600, height: 900 }, 1_000_000)).toBe(false);
    expect(needsScaling({ width: 900, height: 1601 }, 1_000_000)).toBe(true);
    expect(needsScaling({ width: 800, height: 800 }, MAX_PHOTO_BYTES + 1)).toBe(true);
  });
});

describe("outputType", () => {
  it("prefers WebP, else keeps PNG transparency and uses JPEG for the rest", () => {
    expect(outputType("image/jpeg", true)).toBe("image/webp");
    expect(outputType("image/png", true)).toBe("image/webp");
    expect(outputType("image/jpeg", false)).toBe("image/jpeg");
    expect(outputType("image/png", false)).toBe("image/png");
    expect(outputType("image/webp", false)).toBe("image/jpeg");
  });
});

// --- preparePhoto, with the browser's decoder and canvas stubbed ---

interface FakeCanvas {
  width: number;
  height: number;
  drawn: number;
  asked: { type: string; quality: number }[];
}

function stubBrowser(source: { width: number; height: number }, opts: { webp?: boolean; bytes?: number; decodeFails?: boolean } = {}) {
  const canvases: FakeCanvas[] = [];
  const close = vi.fn();
  const decode = vi.fn(async () => {
    if (opts.decodeFails) throw new Error("bad image");
    return { width: source.width, height: source.height, close };
  });
  vi.stubGlobal("createImageBitmap", decode);
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") return realCreate(tag);
    const c: FakeCanvas & Record<string, unknown> = { width: 0, height: 0, drawn: 0, asked: [] };
    c.getContext = () => ({ imageSmoothingEnabled: false, imageSmoothingQuality: "low", drawImage: () => (c.drawn += 1) });
    c.toBlob = (cb: (b: Blob | null) => void, type: string, quality: number) => {
      c.asked.push({ type, quality });
      const outType = type === "image/webp" && opts.webp === false ? "image/png" : type;
      cb(new Blob([new Uint8Array(opts.bytes ?? 1000)], { type: outType }));
    };
    canvases.push(c);
    return c as unknown as HTMLCanvasElement;
  }) as typeof document.createElement);
  return { canvases, decode, close };
}

const jpeg = (bytes = 3_000_000) => new File([new Uint8Array(bytes)], "hoodie.jpeg", { type: "image/jpeg" });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("preparePhoto", () => {
  it("sends a small photo untouched", async () => {
    const { canvases, decode, close } = stubBrowser({ width: 800, height: 600 });
    const file = jpeg(200_000);
    expect(await preparePhoto(file)).toBe(file);
    expect(decode).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
    expect(canvases).toHaveLength(0);
    expect(close).toHaveBeenCalled();
  });

  it("scales a phone photo down to 1600 px as WebP, halving in steps first", async () => {
    const { canvases, close } = stubBrowser({ width: 4032, height: 3024 });
    const out = await preparePhoto(jpeg());
    const last = canvases[canvases.length - 1];
    expect([last.width, last.height]).toEqual([1600, 1200]);
    expect(canvases.length).toBeGreaterThan(1); // 4032 → 2016 → 1600
    expect(last.asked).toEqual([{ type: "image/webp", quality: 0.85 }]);
    expect(out.name).toBe("hoodie.webp");
    expect(out.type).toBe("image/webp");
    expect(close).toHaveBeenCalled();
  });

  it("falls back to JPEG where the browser can't encode WebP", async () => {
    const { canvases } = stubBrowser({ width: 4032, height: 3024 }, { webp: false });
    const out = await preparePhoto(jpeg());
    expect(canvases[canvases.length - 1].asked.map((a) => a.type)).toEqual(["image/webp", "image/jpeg"]);
    expect([out.name, out.type]).toEqual(["hoodie.jpg", "image/jpeg"]);
  });

  it("says when a photo can't be read", async () => {
    stubBrowser({ width: 1, height: 1 }, { decodeFails: true });
    await expect(preparePhoto(jpeg())).rejects.toEqual(new PhotoPrepError("This photo couldn't be read. Try another file."));
  });

  it("says when a photo is still too big after scaling", async () => {
    stubBrowser({ width: 4032, height: 3024 }, { bytes: MAX_PHOTO_BYTES + 1 });
    await expect(preparePhoto(jpeg())).rejects.toEqual(
      new PhotoPrepError("This photo is still over 5 MB after scaling. Try a smaller one."),
    );
  });
});
