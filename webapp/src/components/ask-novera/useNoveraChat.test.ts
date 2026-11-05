// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
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
// KIND, either express governing permissions and limitations
// under the License.

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useNoveraChat } from "./useNoveraChat";

const mockAuthedPost = vi.fn();
vi.mock("@api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@api/http")>();
  return {
    ...actual,
    authedPost: (...args: unknown[]) => mockAuthedPost(...args),
  };
});

vi.mock("@hooks/useAccessToken", () => ({
  useAccessToken: () => async () => "test-token",
}));

vi.mock("@config/apiConfig", () => ({
  agentOrchestratorServiceUrls: { chat: "https://agent.test/chat" },
  isAgentOrchestratorConfigured: () => true,
}));

describe("useNoveraChat generation tracking", () => {
  beforeEach(() => {
    mockAuthedPost.mockReset();
  });

  it("discards in-flight responses and resets isLoading after clearMessages", async () => {
    let resolvePost!: (value: unknown) => void;
    mockAuthedPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );

    const { result } = renderHook(() => useNoveraChat());

    // 1. Send query A and allow microtasks (getAccessToken) to run so authedPost is called
    act(() => {
      void result.current.sendMessage("Query A");
    });
    await Promise.resolve();
    expect(mockAuthedPost).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toHaveLength(1);

    // 2. Clear messages while request A is in-flight
    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(0);

    // 3. Resolve request A after clearMessages
    await act(async () => {
      resolvePost({ response: "Response A", bucket: "LEAVE_STANDARD" });
    });

    // Transcript should remain empty because request A's generation was superseded
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeBucket).toBeNull();
  });

  it("discards in-flight errors after clearMessages", async () => {
    let rejectPost!: (error: unknown) => void;
    mockAuthedPost.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectPost = reject;
        }),
    );

    const { result } = renderHook(() => useNoveraChat());

    act(() => {
      void result.current.sendMessage("Query Failing");
    });
    await Promise.resolve();
    expect(mockAuthedPost).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      rejectPost(new Error("Network failed"));
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it("allows subsequent search query B to proceed while query A is in-flight and drops A", async () => {
    let resolveQueryA!: (value: unknown) => void;
    let resolveQueryB!: (value: unknown) => void;

    mockAuthedPost
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveQueryA = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveQueryB = resolve;
          }),
      );

    const { result } = renderHook(() => useNoveraChat());

    // 1. Send query A
    act(() => {
      void result.current.sendMessage("Query A");
    });
    await Promise.resolve();
    expect(result.current.isLoading).toBe(true);

    // 2. Clear messages
    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.isLoading).toBe(false);

    // 3. Immediately send query B
    act(() => {
      void result.current.sendMessage("Query B");
    });
    await Promise.resolve();
    expect(result.current.isLoading).toBe(true);

    // 4. Stale query A finishes late
    await act(async () => {
      resolveQueryA({ response: "Response A", bucket: "LEAVE_STANDARD" });
    });

    // Query A response must NOT be accepted, and isLoading must remain true for B
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Query B");
    expect(result.current.isLoading).toBe(true);

    // 5. Query B finishes
    await act(async () => {
      resolveQueryB({ response: "Response B", bucket: "PO_MENU" });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].text).toBe("Query B");
    expect(result.current.messages[1].text).toBe("Response B");
    expect(result.current.activeBucket).toBe("PO_MENU");
  });

  it("handles status error response by tagging message as error and omitting activeBucket", async () => {
    mockAuthedPost.mockResolvedValueOnce({
      status: "error",
      response: "Unable to process leave request at this time",
      bucket: "LEAVE_STANDARD",
    });

    const { result } = renderHook(() => useNoveraChat());

    act(() => {
      void result.current.sendMessage("Check leave");
    });
    await Promise.resolve();
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Unable to process leave request at this time");
    expect(result.current.activeBucket).toBeNull();
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].isError).toBe(true);
    expect(result.current.messages[1].text).toBe(
      "Error: Unable to process leave request at this time",
    );
  });
});
