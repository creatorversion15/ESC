# Security Specification: ESC Platform

## Data Invariants
1. **Verified Super Admin & RBAC Isolation**:
   - Super Admin authority requires Firebase Auth with `email_verified == true` and either the configured primary Super Admin email (`soviraj50@gmail.com`) or a Super Admin record in `/admins/{uid}`.
   - Normal users cannot read other users' private profiles or list `/users`, and cannot set or elevate their own `role` or `membershipStatus` to `approved`, `admin`, `project_lead`, or `superadmin`.
   - Only `superadmin` can modify administrator allowlist entries (`/admins/{adminId}`), assign/revoke `admin` or `superadmin` roles, or edit critical website configuration (`/siteSettings/{settingId}`).
2. **Application Ownership & State Transitions**:
   - An application can only be created with `userId == request.auth.uid` and initial status `draft` or `submitted`.
   - Students can only modify their application while in `draft` or `more_info_required` state and cannot modify `adminNotes` or `reviewedBy`.
3. **Confidential Ideas & Unpublished Events**:
   - Private startup ideas (`isPublic == false` or `reviewStatus != 'approved'`) cannot be read by unauthenticated or non-owner/non-admin users.
   - Unpublished events (`isPublished == false`) are visible only to Admins.
4. **Certificate Integrity**:
   - Certificates can only be created, modified, or revoked by verified Admins (`isAdmin()`). Public read is permitted strictly for credential verification.
5. **Immutable Audit Trail**:
   - Administrative logs (`/adminLogs`) are append-only by verified Admins; updates and deletions are denied.

## The Dirty Dozen Test Cases
1. Unauthenticated client tries to list `/users` -> Expected: PERMISSION_DENIED.
2. User A tries to read User B's profile `/users/{userB}` or application `/applications/{appB}` -> Expected: PERMISSION_DENIED.
3. User A tries to elevate their role from `student` to `superadmin` in `/users/{userA}` -> Expected: PERMISSION_DENIED.
4. Regular `admin` tries to edit `/admins/{uid}` or `/siteSettings/public` -> Expected: PERMISSION_DENIED.
5. Unauthenticated client or regular user tries to read `/adminLogs` -> Expected: PERMISSION_DENIED.
6. Admin tries to update or delete an existing `/adminLogs/{logId}` entry -> Expected: PERMISSION_DENIED.
7. User A tries to forge a certificate in `/certificates/{certId}` -> Expected: PERMISSION_DENIED.
8. User A tries to modify a project led by User B without being `leaderId`, in `teamMemberIds`, or an Admin -> Expected: PERMISSION_DENIED.
9. Unauthenticated user attempts to create a startup idea or problem statement -> Expected: PERMISSION_DENIED.
10. User A tries to read private startup ideas (`isPublic == false`) owned by User B -> Expected: PERMISSION_DENIED.
11. User A tries to create or delete `/announcements/{id}` or `/events/{id}` -> Expected: PERMISSION_DENIED.
12. Malicious user attempts to approve their own membership application (`status: 'approved'`) -> Expected: PERMISSION_DENIED.
