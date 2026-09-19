// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { HttpError } from "./http";
import { describeError } from "./errors";

describe("describeError", () => {
  it("prefers a flat { message } body", () => {
    const error = new HttpError("/x", 400, JSON.stringify({ message: "Flat message." }));
    expect(describeError(error)).toBe("Flat message.");
  });

  it("falls back to a nested { error: { message } } body", () => {
    const error = new HttpError(
      "/x",
      400,
      JSON.stringify({ error: { code: 400, message: "Hotfix update (ID - 42) already exists." } }),
    );
    expect(describeError(error)).toBe("Hotfix update (ID - 42) already exists.");
  });

  it("prefers the flat message when both shapes are present", () => {
    const error = new HttpError(
      "/x",
      400,
      JSON.stringify({ message: "Flat wins.", error: { message: "Nested loses." } }),
    );
    expect(describeError(error)).toBe("Flat wins.");
  });

  it("falls back to a generic HTTP-status message for a malformed or empty body", () => {
    expect(describeError(new HttpError("/x", 500, "not json"))).toBe("Something went wrong (HTTP 500).");
    expect(describeError(new HttpError("/x", 404, ""))).toBe("Something went wrong (HTTP 404).");
    expect(describeError(new HttpError("/x", 400, JSON.stringify({ error: {} })))).toBe(
      "Something went wrong (HTTP 400).",
    );
  });

  it("falls back to a plain Error's message", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });

  it("falls back to a generic message for an unrecognized value", () => {
    expect(describeError("nope")).toBe("Something went wrong.");
  });
});
