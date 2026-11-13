// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import type { UmtBaseProduct } from "../api/umtProducts";
import {
  EMPTY_CREATE_PRODUCT_FORM,
  buildUmtCreateProductRequest,
  isCreateProductFormValid,
  isValidFtpPort,
  productRowId,
  unwrapUmtErrorMessage,
  type UmtCreateProductFormValues,
} from "./umtProducts";

function form(overrides: Partial<UmtCreateProductFormValues> = {}): UmtCreateProductFormValues {
  return {
    name: "wso2am",
    version: "4.0.0",
    leadMail: "lead@wso2.com",
    edMail: "ed@wso2.com",
    platform: "",
    ftpHost: "ftp.wso2.com",
    ftpPort: "21",
    ftpUsername: "ftpuser",
    ftpPassword: "secret",
    ftpAbsolutePath: "/updates",
    ...overrides,
  };
}

function baseProduct(overrides: Partial<UmtBaseProduct> = {}): UmtBaseProduct {
  return {
    name: "wso2am",
    version: "4.0.0.0.full",
    isActive: true,
    createdBy: "admin@wso2.com",
    createdOn: "2026-01-01 09:14:22.0",
    ...overrides,
  };
}

describe("productRowId", () => {
  it("combines name and version into a composite id", () => {
    expect(productRowId(baseProduct())).toBe(JSON.stringify(["wso2am", "4.0.0.0.full"]));
  });

  it("does not collide when a hyphen moves between name and version", () => {
    const a = productRowId(baseProduct({ name: "foo-bar", version: "1.0.full" }));
    const b = productRowId(baseProduct({ name: "foo", version: "bar-1.0.full" }));
    expect(a).not.toBe(b);
  });
});

describe("isCreateProductFormValid", () => {
  it("accepts a fully populated form", () => {
    expect(isCreateProductFormValid(form())).toBe(true);
  });

  it("rejects the empty form", () => {
    expect(isCreateProductFormValid(EMPTY_CREATE_PRODUCT_FORM)).toBe(false);
  });

  it("rejects a form with any single blank or whitespace-only field", () => {
    expect(isCreateProductFormValid(form({ name: "" }))).toBe(false);
    expect(isCreateProductFormValid(form({ ftpPassword: "   " }))).toBe(false);
  });

  it("accepts a form with no platform picked", () => {
    expect(isCreateProductFormValid(form({ platform: "" }))).toBe(true);
  });

  it("rejects a form whose FTP port is not a port number", () => {
    expect(isCreateProductFormValid(form({ ftpPort: "ftp" }))).toBe(false);
  });
});

describe("isValidFtpPort", () => {
  it.each(["1", "21", " 22 ", "65535"])("accepts %j", (port) => {
    expect(isValidFtpPort(port)).toBe(true);
  });

  it.each(["", "0", "65536", "-21", "+21", "21.0", "21/tcp", "ftp"])("rejects %j", (port) => {
    expect(isValidFtpPort(port)).toBe(false);
  });
});

describe("buildUmtCreateProductRequest", () => {
  it("trims every field except the password and suffixes the version with .0.full", () => {
    expect(
      buildUmtCreateProductRequest(
        form({
          name: "  wso2am  ",
          version: "  4.0.0  ",
          ftpPassword: "  secret  ",
        }),
      ),
    ).toEqual({
      name: "wso2am",
      version: "4.0.0.0.full",
      leadMail: "lead@wso2.com",
      edMail: "ed@wso2.com",
      FTPHost: "ftp.wso2.com",
      FTPPort: "21",
      FTPUsername: "ftpuser",
      FTPPassword: "  secret  ",
      FTPPath: "/updates",
    });
  });

  it("leaves the platform out when none is picked", () => {
    expect(buildUmtCreateProductRequest(form())).not.toHaveProperty("platform");
  });

  it("sends the picked platform", () => {
    expect(buildUmtCreateProductRequest(form({ platform: "APIM" }))).toEqual(
      expect.objectContaining({ platform: "APIM" }),
    );
  });
});

describe("unwrapUmtErrorMessage", () => {
  it("returns the message inside a JSON-wrapped error", () => {
    expect(unwrapUmtErrorMessage('{"message":"Product already exists"}')).toBe("Product already exists");
  });

  it("returns plain text unchanged", () => {
    expect(unwrapUmtErrorMessage("Base product not found")).toBe("Base product not found");
  });

  it("returns JSON without a message unchanged", () => {
    expect(unwrapUmtErrorMessage('{"code":400}')).toBe('{"code":400}');
  });
});
