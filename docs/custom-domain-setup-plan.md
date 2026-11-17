# NIG Central: Staging, New Production and Handover

**Status:** Draft, updated 2026-11-17

## Summary

| Section      | Goal                                                                                                          | Status                                                                                                                                                     | Tasks done |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Staging      | Staging stays on `nig-central-staging.vercel.app` only; "First sign in?" tried here first for the dev account | Cleaned up. The first-sign-in code is on staging; it cannot finish there because of the other Auth0 account, so the live test moves to the new production. | 9 of 13    |
| Prod         | A new, separate production at `central.nigmarketing.ph`                                                       | Live and empty except the dev account. Auth0 is set up; its secrets and the dev login are next. Data is not loaded.                                        | 20 of 29   |
| Giving email | Email, GitHub and hosting handed over to NIG                                                                  | Not started                                                                                                                                                | 0 of 23    |

The existing production at `nig-central.vercel.app` is not changed by any task below.

---

## Staging

Address: `https://nig-central-staging.vercel.app`. There is no custom hostname for staging.

**Done**

- [x] Tried a custom hostname on staging (`central-staging.nigmarketing.ph`) and confirmed it worked
- [x] Decision: staging stays on `nig-central-staging.vercel.app` only
- [x] Vercel: `central-staging.nigmarketing.ph` removed from the `frontend` project
- [x] Railway (staging): `FRONTEND_URL` set back to the single original value, which also fixes the password-reset and invite links
- [x] Verify: staging responds, and the staging backend allows only its own address
- [x] GoDaddy: deleted the leftover CNAME `central-staging`; `nigmarketing.ph` is back to its original records plus `central`
- [x] Built the "First sign in?" flow for the dev account only (sign-in page unchanged plus a "First sign in?" link, an email-only screen, then "Set password" with a confirmation field). Committed and pushed to `development` in both repositories on 2026-11-17 (backend `6977abe4`, frontend `5798acc6`), so staging builds it. Checked before the push: type check, format, lint, all 136 auth tests, and a browser run of every screen and message.
- [x] Staging database: the dev account `dev@prominent.com` (Prominent Dev, Business Owner, no login yet) created
- [x] Railway (staging backend): `FIRST_LOGIN_ALLOWED_EMAILS` (`dev@prominent.com`) and `FIRST_LOGIN_CLAIM_UNTIL` (`2026-11-24T18:00:00+08:00`) added and deployed. They have no effect until the code is merged.

**Remaining**

- [ ] Verify: a password-reset email links to `nig-central-staging.vercel.app`
- [ ] Auth0 (project owner): on the sign-in application, enable the Client Credentials grant and authorize it on the Auth0 Management API with `read:users`, `create:users`, `update:users` and `delete:users`. No new secret is needed.
- [ ] Staging cannot finish "Set password" while it uses the other Auth0 account (no Management API permission there). Test the flow on the new production instead.
- [ ] Live test on staging: "First sign in?", enter `dev@prominent.com`, "Set password", and arrive signed in. Then check the other messages ("already has an account", "not found", "isn't open for this email").

---

## Prod

A separate production for NIG with its own empty database. Address: `https://central.nigmarketing.ph`. Backend: `https://backend-production-70d3d6c3.up.railway.app`.

**Done**

- [x] Decision: separate new production, existing production untouched
- [x] Railway: new project with Postgres
- [x] Railway: backend service from the backend repository `main`, with the pre-deploy command `pnpm prisma migrate deploy`
- [x] Railway: `DATABASE_URL`, `NODE_ENV`, `FRONTEND_URL`, `APP_URL` set
- [x] Railway: remaining backend variables added by the project owner
- [x] Backend running, with 559 migrations applied and none pending
- [x] Vercel: `nig-central-prod` created from the frontend repository `main`, with `API_URL` and `NEXT_PUBLIC_WS_URL`, and deployed
- [x] GoDaddy: CNAME `central` added, pointing to `dc29c40e47ef103e.vercel-dns-017.com`
- [x] `central.nigmarketing.ph` verified in Vercel, SSL issued, login page served
- [x] CORS on the new backend allows `central.nigmarketing.ph`
- [x] Database confirmed empty: only the migration history and three reference lists (permissions, tax codes, expense types) hold rows
- [x] Clean `main` checkout and a throwaway local database created for the bootstrap rehearsal
- [x] Removed the redundant `nig-central-prod.vercel.app` alias, so the project has only `central.nigmarketing.ph`
- [x] Rehearsed a structure-only bootstrap on a fresh local copy (41 branches, 38 roles, 272 accounts, settings; no users or balances). Not used: the project owner wants one account and no other data.
- [x] Decision: the production holds one account only, with no branches, chart of accounts, items, stock or balances
- [x] Created the dev account in the new production: `dev@prominent.com` (Prominent Dev, Business Owner), with the company record and one role holding the all-permissions row. Six rows added; every other table is unchanged.
- [x] Auth0 (own tenant `dev-pgj2rlp7xxb1ffwc`): created the API `NIG Central API` (identifier `https://central.nigmarketing.ph/api`) and the Regular Web Application `NIG Central`, with the Password and Client Credentials grants; Default Directory set to `Username-Password-Authentication`
- [x] Auth0: authorized `NIG Central` on the Auth0 Management API with `read:users`, `create:users`, `update:users`, `delete:users` and `create:user_tickets`
- [x] Released to `main` on 2026-11-17 by fast-forward (backend `6977abe4`, frontend `5798acc6`), which deployed both productions. Four migrations ran on each database (they only rename two bank options, add permissions and a role, and add one table). `/first-login` is served on the new production, the existing production and staging.
- [x] Railway (new production backend): `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `ISSUER_BASE_URL`, the new `AUTH0_CLIENT_ID`, `FIRST_LOGIN_ALLOWED_EMAILS` (`dev@prominent.com`) and `FIRST_LOGIN_CLAIM_UNTIL` (`2026-11-24T18:00:00+08:00`) set by the assistant; the new `AUTH0_CLIENT_SECRET` and a new `JWT_SECRET` (it was missing) entered by the project owner; deployed on 2026-11-17. Check: the backend answers `set_password` for `dev@prominent.com` and "unavailable" for any other email.

**Remaining**

- [ ] Confirm `ENCRYPTION_KEY` is the generated value, not a placeholder
- [ ] Set the dev account's password through "First sign in?" on `central.nigmarketing.ph` (the project owner types it; no login is created by hand in Auth0), then confirm sign-in works
- [ ] Decide file storage
- [ ] Deferred: add the real NIG owner and users, after the dev account is working
- [ ] Deferred: receive the opening-balance file list, load it and reconcile the totals
- [ ] Rename the Railway project from `unique-solace`
- [ ] Verify login, a data-backed page and the reset-email host
- [ ] Delete the three throwaway local databases (`nig-bootstrap-test`, `nig-bootstrap-structure-test`, `nig-dev-account-test`) and the scratch checkout
- [ ] Announce the new URL to users

---

## Giving email

The handover to NIG: the mailbox, then GitHub, then the hosting accounts. None of it affects the live applications until the hosting transfers.

**Email**

- [ ] Confirm the role address (for example `tech@nigmarketing.com`) and the Workspace licence cost with NIG
- [ ] Workspace admin creates the mailbox
- [ ] Enable 2-step verification
- [ ] Set the recovery email and phone to NIG-controlled values
- [ ] Confirm a test message is received

**Transfer the email to NIG**

- [ ] Hand the mailbox credentials to the NIG owner (Elijah or a NIG designee)
- [ ] NIG changes the password and re-confirms 2-step verification and recovery details
- [ ] Remove any temporary access held by the project team
- [ ] Store the credentials in a password manager controlled by NIG

**GitHub, using the NIG email**

- [ ] Create a GitHub account with the NIG email, owned by a named NIG person
- [ ] Enable 2FA and store the recovery codes with NIG
- [ ] Create a NIG GitHub organization owned by that account
- [ ] Transfer the `backend` and `frontend` repositories from `the-prominent-enterprise-nig` into it
- [ ] Reconnect Vercel and Railway to the organization's repositories
- [ ] Confirm a push to `main` still triggers a deployment on both hosts

**Hosting**

- [ ] Create a Vercel team using the NIG email, with NIG billing on a paid plan
- [ ] Transfer the Vercel `nig-central-prod` project and re-attach `central.nigmarketing.ph`
- [ ] Create a Railway workspace using the NIG email, with NIG billing
- [ ] Transfer the new Railway project (backend and Postgres)
- [ ] Transfer the Auth0 tenant, or add NIG as admin
- [ ] Rotate secrets: Auth0 client secret, database password, `JWT_SECRET`, `ENCRYPTION_KEY`, `RESEND_API_KEY`
- [ ] Update the variables on the transferred projects with the rotated values and redeploy
- [ ] Verify login, a data-backed page and a password-reset email

---

## Reference

### Addresses

| Environment                     | Address                                              |
| ------------------------------- | ---------------------------------------------------- |
| Staging                         | `https://nig-central-staging.vercel.app`             |
| New production                  | `https://central.nigmarketing.ph`                    |
| New production backend          | `https://backend-production-70d3d6c3.up.railway.app` |
| Existing production (unchanged) | `https://nig-central.vercel.app`                     |

### Decisions

- **Staging:** stays on `nig-central-staging.vercel.app`. No custom hostname and no separate staging for the new domain.
- **Domain:** the production hostname is a subdomain of `nigmarketing.ph`, already registered to NIG at GoDaddy. No new domain is purchased.
- **Production:** new and separate. The existing production keeps its address and data and is not wiped.
- **Production contents:** one account only, the dev account `dev@prominent.com`, with a company record and one Business Owner role holding the all-permissions row. No branches, chart of accounts, items, stock or balances until instructed.
- **Data:** the new production starts empty and is loaded from NIG's opening-balance files.
- **Hosting:** frontend on Vercel, backend and database on Railway. No hosting migration.
- **Auth0:** login is a server-to-server call from the backend, so no redirect URLs are involved. Staging and the existing production use a tenant in the JP region (`dev-mpc2r5rtausjckvy`) that belongs to another account. The new production gets its own Auth0 setup in the project owner's tenant (`dev-pgj2rlp7xxb1ffwc`), so its logins are separate from theirs.
- **Credentials source:** Resend values for the new production come from the existing production environment. The Auth0 values are new and come from the project owner's tenant.
- **Backend hostname:** the backend keeps its Railway address. A custom API hostname is deferred.
- **Secrets:** entered into Railway and Vercel by the project owner, not typed by assistants. `JWT_SECRET` and `ENCRYPTION_KEY` are fresh values.

### Deployment behaviour

- A merge to `development` updates staging only.
- A merge to `main` updates both the existing production and the new production, and migrations run on both. Check the new production after each release.
- The new Vercel project also builds every push to `development` as an unused preview.

### Notes

- `prisma db seed` wipes the business tables and also creates test users, demo data, the item catalog with stock and an opening inventory journal. It is not run on production. Only a structure-only bootstrap is run, after a rehearsal on a throwaway database, from a clean checkout of `main`.
- The dev account was added with six inserts run in Railway's database console, rehearsed first on a fresh local copy in the same starting state. The scripts exist only in a scratch checkout of `main`, not in the repository. The unused structure-only bootstrap showed that the standard seed leaves demo money behind (3 petty cash vouchers and ₱193,600 in bank balances), which is another reason the full seed is never run on production.
- The dev account holds a single all-permissions row (`*:*:*`), which the permission check treats as access to everything. The 163 newer permissions that exist only in the seed are therefore not needed for it.
- The new database already holds 264 permission rows, 21 tax codes and 16 expense types from the migrations. The bootstrap must not clash with them.
- Login matches the Auth0 identity to a database user by email, and a user created in advance wins. The dev account is therefore a database user with the Business Owner role, plus an Auth0 login with the same email.
- `ENCRYPTION_KEY` must be a final value. If it is missing, the backend generates a temporary key. If it is changed after data is stored, encrypted fields become unreadable.
- Email is sent through Resend with a default sender at `tpe-nig.com`. Sending from a NIG domain requires verifying that domain with Resend.
- The Vercel team's Pro trial showed 2 days left on 2026-11-17.
- First sign in is limited by two backend variables. `FIRST_LOGIN_ALLOWED_EMAILS` is a comma-separated list; if it is unset, every email without a password may use the flow while the window is open. `FIRST_LOGIN_CLAIM_UNTIL` is the end of the window; after it, the flow answers "isn't open". Once the code is released, the "First sign in?" link appears on every sign-in page, and anyone outside the list sees that message.
- The later cutover (not started): remove the shared-password logins and close the shared key, so each person sets their own password through this flow.
- Rotating `JWT_SECRET` invalidates existing tokens, so all users sign in again.
- Vercel ties a domain to one project at a time, so `central.nigmarketing.ph` is removed and re-added during the Vercel transfer.

### Rollback (new production)

Delete the new Railway project and the `nig-central-prod` Vercel project, and remove the `central` CNAME. The existing production and staging are unaffected.

### Corrections to earlier drafts

- Auth0 redirect URLs do not need to change. The `@auth0/nextjs-auth0` package is installed but never used.
- A two-value `FRONTEND_URL` breaks the password-reset and invite links, because only the CORS code splits the list. Staging is back to a single value, so its links are correct.
- The repositories are already under the `the-prominent-enterprise-nig` organization, not a personal account.
- The Auth0 and Resend values come from the existing production, not staging.
