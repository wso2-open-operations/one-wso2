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

import { useCallback, useId, useRef, useState } from "react";
import { authedPost, humanizeHttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { agentOrchestratorServiceUrls, isAgentOrchestratorConfigured } from "@config/apiConfig";
import type {
  AgentOrchestratorChatRequest,
  AgentOrchestratorChatResponse,
  NoveraChatMessage,
} from "./types";

/** Generates a stable session ID safe for Agent Orchestrator character restrictions. */
function generateSessionId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}-${timePart}-${randomPart}`;
}

/** Hook managing conversational state and requests to the Agent Orchestrator. */
export function useNoveraChat() {
  const hookId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const sessionIdRef = useRef<string>(generateSessionId(`one-wso2-${hookId}`));
  const generationRef = useRef<number>(0);
  const getAccessToken = useAccessToken();

  const [messages, setMessages] = useState<NoveraChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText || isLoading) {
        return;
      }

      const generation = generationRef.current;

      setError(null);
      setActiveBucket(null);

      const userMessage: NoveraChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: "user",
        text: trimmedText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      if (!isAgentOrchestratorConfigured()) {
        const unconfiguredMessage: NoveraChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: "Agent Orchestrator is not connected. Configure ONE_WSO2_AGENT_ORCHESTRATOR_URL in public/config.js.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, unconfiguredMessage]);
        return;
      }

      setIsLoading(true);

      try {
        const accessToken = await getAccessToken();
        if (generation !== generationRef.current) {
          return;
        }

        const payload: AgentOrchestratorChatRequest = {
          session_id: sessionIdRef.current,
          message: trimmedText,
          context: {
            channel: "onewso2_web",
          },
        };

        const result = await authedPost<AgentOrchestratorChatResponse>(
          agentOrchestratorServiceUrls.chat,
          accessToken,
          payload,
        );

        if (generation !== generationRef.current) {
          return;
        }

        if (!result || !result.response) {
          throw new Error("Received empty response from assistant.");
        }

        if (result.status === "error") {
          const errorText = result.response.startsWith("Error:")
            ? result.response
            : `Error: ${result.response}`;
          setError(result.response);
          setActiveBucket(null);

          const errorMessage: NoveraChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            text: errorText,
            timestamp: new Date(),
            isError: true,
          };
          setMessages((prev) => [...prev, errorMessage]);
          return;
        }

        setActiveBucket(result.bucket ?? null);

        const assistantMessage: NoveraChatMessage = {
          id: `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: "assistant",
          text: result.response,
          timestamp: new Date(),
          bucket: result.bucket,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        if (generation !== generationRef.current) {
          return;
        }

        const humanizedMessage = humanizeHttpError(err);
        setError(humanizedMessage);

        const errorMessage: NoveraChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Error: ${humanizedMessage}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        if (generation === generationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [getAccessToken, isLoading],
  );

  const clearMessages = useCallback(() => {
    generationRef.current += 1;
    setMessages([]);
    setError(null);
    setActiveBucket(null);
    setIsLoading(false);
    sessionIdRef.current = generateSessionId(`one-wso2-${hookId}`);
  }, [hookId]);

  return {
    messages,
    isLoading,
    error,
    activeBucket,
    sendMessage,
    clearMessages,
    isConfigured: isAgentOrchestratorConfigured(),
  };
}
