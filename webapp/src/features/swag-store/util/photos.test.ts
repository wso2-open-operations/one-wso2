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

import { describe, expect, it } from "vitest";
import { checkPhotoFile, MAX_PHOTO_BYTES, MAX_PHOTO_EDGE, MAX_SOURCE_BYTES, PHOTO_VIEWS, photoAlt, photoLabel } from "./photos";

describe("photo views", () => {
  it("keeps gallery order, front first", () => {
    expect(PHOTO_VIEWS).toEqual(["front", "back", "left", "right", "top", "bottom", "detail-1", "detail-2", "detail-3", "detail-4"]);
    expect(MAX_PHOTO_EDGE).toBe(1600);
  });

  it("labels views and builds default alt text", () => {
    expect(photoLabel("front")).toBe("Front");
    expect(photoLabel("left")).toBe("Left side");
    expect(photoLabel("right")).toBe("Right side");
    expect(photoLabel("detail-2")).toBe("Detail 2");
    expect(photoAlt({ view: "back", alt: "" }, "WSO2 Hoodie")).toBe("WSO2 Hoodie, Back");
    expect(photoAlt({ view: "back", alt: "  " }, "WSO2 Hoodie")).toBe("WSO2 Hoodie, Back");
    expect(photoAlt({ view: "back", alt: "Logo print" }, "WSO2 Hoodie")).toBe("Logo print");
  });
});

describe("checkPhotoFile", () => {
  it("refuses other types, empty files and huge originals", () => {
    expect(checkPhotoFile(new File(["x"], "a.heic", { type: "image/heic" }))).toBe("Use a JPEG, PNG or WebP photo.");
    expect(checkPhotoFile(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" }))).toBe("Use a JPEG, PNG or WebP photo.");
    expect(checkPhotoFile(new File([], "a.png", { type: "image/png" }))).toBe("The file is empty.");
    expect(checkPhotoFile(new File([new Uint8Array(MAX_SOURCE_BYTES + 1)], "a.jpg", { type: "image/jpeg" }))).toBe(
      "Photos are at most 25 MB.",
    );
  });

  it("lets big photos through: they are scaled down before upload", () => {
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024);
    expect(checkPhotoFile(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "a.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(checkPhotoFile(new File(["x"], "a.webp", { type: "image/webp" }))).toBeNull();
  });
});
