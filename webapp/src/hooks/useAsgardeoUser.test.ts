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

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { isSignedIn: true };
const getDecodedIdToken = vi.fn();
vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({ isSignedIn: session.isSignedIn, getDecodedIdToken }),
}));

const { useAsgardeoUser } = await import("./useAsgardeoUser");

beforeEach(() => {
  session.isSignedIn = true;
  getDecodedIdToken.mockReset();
  getDecodedIdToken.mockResolvedValue({ sub: "u1", email: "jane@wso2.com", given_name: "Jane", family_name: "Doe" });
});

describe("useAsgardeoUser", () => {
  it("reads the signed-in user from the ID token", async () => {
    const { result } = renderHook(() => useAsgardeoUser());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({ sub: "u1", email: "jane@wso2.com", initials: "JD" });
  });

  it("forgets the user on sign-out", async () => {
    const { result, rerender } = renderHook(() => useAsgardeoUser());
    await waitFor(() => expect(result.current.ready).toBe(true));

    session.isSignedIn = false;
    rerender();

    expect(result.current).toEqual({ ready: false, initials: "" });
  });

  it("is not ready while signed out", () => {
    session.isSignedIn = false;
    const { result } = renderHook(() => useAsgardeoUser());

    expect(result.current).toEqual({ ready: false, initials: "" });
    expect(getDecodedIdToken).not.toHaveBeenCalled();
  });
});
