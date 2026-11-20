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

import { useEffect } from "react";
import { useNavigate } from "react-router";
import { controlPath } from "./paths";
import type { ControlTarget } from "./dashboardAgentApi";

interface GoToControlProps {
  target: ControlTarget;
  // Called once the user has been taken there, so the popup can get out of the
  // way and not take them there a second time.
  onDone: () => void;
}

// GoToControl takes the user to a control the assistant found for them. It
// draws nothing. The Audit Hub decides what the user may open, so this is only a
// shortcut and never a way in.
export default function GoToControl({ target, onDone }: GoToControlProps): null {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(controlPath(target.audit_id, target.control_id));
    onDone();
    // Once, for this target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.audit_id, target.control_id]);
  return null;
}
