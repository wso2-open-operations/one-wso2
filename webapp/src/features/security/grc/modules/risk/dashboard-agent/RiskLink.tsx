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

import { Link } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";
import { Link as RouterLink, useInRouterContext } from "react-router";
import { riskPath } from "./paths";

interface RiskLinkProps {
  id: number;
  children: ReactNode;
  // Called when the link is followed, so the popup can get out of the way.
  onNavigate?: () => void;
}

// RiskLink opens a risk in Risk Registers. Outside a router (as in isolated
// tests) it shows the text without a link.
export default function RiskLink({ id, children, onNavigate }: RiskLinkProps): JSX.Element {
  const inRouter = useInRouterContext();
  if (!inRouter) return <>{children}</>;
  return (
    <Link component={RouterLink} to={riskPath(id)} onClick={onNavigate} underline="hover">
      {children}
    </Link>
  );
}
