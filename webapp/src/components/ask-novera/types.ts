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

/** Role of a message in the Novera chat conversation. */
export type ChatRole = "user" | "assistant" | "system";

/** A single chat message in the Ask Novera transcript. */
export interface NoveraChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Author role of the message */
  role: ChatRole;
  /** Text content of the message */
  text: string;
  /** When the message was generated */
  timestamp: Date;
  /** Active domain bucket assigned by the router */
  bucket?: string;
  /** Whether this message represents an error response */
  isError?: boolean;
}

/** Request payload expected by Agent Orchestrator POST /chat. */
export interface AgentOrchestratorChatRequest {
  /** Unique session ID for conversation continuity */
  session_id: string;
  /** User prompt or message */
  message: string;
  /** Optional contextual metadata */
  context?: Record<string, unknown>;
}

/** Response payload returned by Agent Orchestrator POST /chat. */
export interface AgentOrchestratorChatResponse {
  /** Assistant response text */
  response: string;
  /** Status indicator ("success" | "error") */
  status: string;
  /** Active routed domain bucket (e.g. "LEAVE_STANDARD") */
  bucket?: string;
}

