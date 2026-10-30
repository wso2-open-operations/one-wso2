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


import { useState, type ReactNode } from "react";
import { ButtonBase } from "@wso2/oxygen-ui";
import { useAmplifyDashboardAccess } from "../api/useAmplifyEditorAccess";
import type { PersonRef } from "../api/usePersonLookup";
import PersonDetailDialog from "../pages/dashboards/PersonDetailDialog";

/**
 * A person's name. For anyone granted `CAN_DASHBOARD` it is a button that opens that person's Post Performance
 * popup; everyone else gets plain text. `onSelect` hands the click to the caller (to close another popup first);
 * without it the link opens the popup itself.
 */
export default function PersonLink({
  person,
  children,
  onSelect,
}: {
  person: PersonRef;
  children: ReactNode;
  onSelect?: (p: PersonRef) => void;
}) {
  const access = useAmplifyDashboardAccess();
  const [open, setOpen] = useState(false);
  if (!access.hasAccess) return <>{children}</>;
  return (
    <>
      <ButtonBase
        onClick={() => (onSelect ? onSelect(person) : setOpen(true))}
        aria-haspopup="dialog"
        sx={{ font: "inherit", color: "inherit", textAlign: "left", "&:hover, &:focus-visible": { textDecoration: "underline" } }}
      >
        {children}
      </ButtonBase>
      {open && <PersonDetailDialog person={person} onClose={() => setOpen(false)} />}
    </>
  );
}
