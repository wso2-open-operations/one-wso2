# The Finance MIS backends are not touched; One WSO2 calls them as they are

Porting Finance MIS into One WSO2 replaces its frontend only: the three Ballerina services
(`app_mis_arr`, `app_mis_flash`, `app_mis_admin`) keep their own numeric privilege scheme resolved
from LDAP groups, their own `x-jwt-assertion` interceptors and their own WSO2 email-domain check.
The old and new frontends run side by side for one full reporting cycle, so any figure that
disagrees between them has to be attributable to the frontend alone — changing a backend in the same
change would make a discrepancy impossible to pin down.

## Consequences

- Finance MIS becomes the first entry in `src/config/apiConfig.ts` with more than one base URL; the
  existing 15 keys are one per app.
- MIS authorization cannot use One WSO2 capabilities. It needs its own gate calling the ARR
  backend's `/user-info`, following the Marketing Ops pattern.
- The privilege number `987` means "may see the ARR Dashboard" to MIS and "every authenticated
  employee" to One WSO2. Reading MIS access off One WSO2's capabilities would hand company-wide
  revenue to every employee. See [CONTEXT.md](../../CONTEXT.md) on **Privilege**.
