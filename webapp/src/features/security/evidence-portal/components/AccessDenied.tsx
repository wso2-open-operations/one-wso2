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

import { Box, Button, Typography } from "@wso2/oxygen-ui";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useSecureSignOut } from "@hooks/useSecureSignOut";
import { clearFileUrlCache } from "../utils/stableFileUrl";

// message comes in as a prop, not from useCurrentUser() here - calling that
// hook in this component adds a second subscriber to the errored identity
// query, which refetches it, resets it to loading, and unmounts this page -
// an endless loop.
interface AccessDeniedProps {
  message?: string;
}

/**
 * Shown instead of the app shell when /api/me comes back 403: signed in to
 * One WSO2, but holding none of this app's roles. No sidebar, no navbar, no
 * routes - this renders above the Router, so it must not use useNavigate,
 * Link, useLocation or <Navigate>, none of which have a Router to attach to
 * here.
 *
 * There is deliberately no Retry or Reload button. The role is carried in
 * the access token (backend/app/auth.py), and a token already issued keeps
 * the claims it was minted with, so no amount of retrying this page can
 * ever succeed. Signing out and back in is the only cure, which is why
 * Sign out is the one action on this page.
 *
 * Sign out goes through One WSO2's own useSecureSignOut rather than the
 * source's Asgardeo signOut() directly (see @hooks/useSecureSignOut) - it
 * clears the shared React Query cache and redirects, and unlike the
 * source's own handleSignOut it has nothing to catch: a failed redirect has
 * no recoverable error to show here, so the Snackbar the source rendered
 * for that case is gone with it.
 */
export default function AccessDenied({ message }: AccessDeniedProps) {
  const { email, displayName } = useAsgardeoUser();
  const secureSignOut = useSecureSignOut();

  const account = email ?? displayName;

  const handleSignOut = () => {
    clearFileUrlCache();
    secureSignOut();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
        gap: 2,
        px: 3,
      }}
    >
      {/* The heading names the cause rather than restating the message
          below it. It used to read "You don't have access to the Evidence
          App", which is the first sentence of `message` word for word, so
          the page opened by saying the same thing twice. */}
      <Typography variant="h4" fontWeight={700}>No role assigned yet</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        {message}
      </Typography>
      {account && (
        <Typography color="text.secondary">
          Signed in as <strong>{account}</strong>.
        </Typography>
      )}
      {/* Says why reloading is pointless and what to do instead. Kept clear
          of the word "administrator", which `message` has already used, so
          this reads as the next step rather than the same instruction
          again. */}
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        Reloading will not help, because your role is read when you sign in. Once you have the role,
        sign out and sign in again.
      </Typography>
      <Button variant="contained" size="large" onClick={handleSignOut} sx={{ mt: 1 }}>
        Sign Out
      </Button>
    </Box>
  );
}
