# NST Events — Student Mobile App Audit, Capabilities & Feature Roadmap

**Target Codebase:** `apps/mobile` (Expo React Native)  
**Reference Document:** `docs/mobile/17-final-student-app-specification.md`, `nst-events-student-ux-spec.md`, `docs/api/02-api-routing-matrix.md`, `docs/frontend/shared/DATA_CONTRACT.md`  
**Date:** September 8, 2026  
**Audience:** Mobile Engineering Team, Product Owners, UI/UX Designers  

---

## 1. Executive Summary

This document provides a comprehensive audit of the **NST Events Student Mobile Application** (`apps/mobile`), detailing:
1. **Current App Inventory:** Every screen, hook, and capability currently functioning in code.
2. **Global Student Capability Matrix:** Everything a student can access across the entire platform (mobile-only, shared web/mobile, and desktop-only workflows).
3. **Immediate V1 Gaps:** Necessary UI and hook integrations required to bring the current mobile codebase into 100% compliance with the frozen V1 contract.
4. **Proposed Feature Roadmap:** High-value student features ready to be added to mobile (Discover & Filtering, Student Leaderboard, Club Directory, In-App Solo Registration, and Team Roster inspection).
5. **Documentation Conflicts & Specification Gaps:** Explicit file:line citations of contradictions across project documentation per project operating rules.

---

## 2. Current Mobile App Inventory (What Is Built Today)

The current mobile application is structured around a **3-Tab Navigation Shell** (`apps/mobile/app/(app)/_layout.tsx`) utilizing a high-contrast Neo-Brutalist design system.

```
┌─────────────────────────────────────────────────────────────┐
│  NST EVENTS // ATTENDANCE                  [🔔 Unread: 3]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    SCROLLABLE FEED AREA                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [ ⊡ ATTENDANCE ]        [ ⟲ HISTORY ]        [ 👤 PROFILE ]│
│       Tab 1                  Tab 2                Tab 3     │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Screen-by-Screen Codebase Audit

| Route / File | Type | Current Implementation & State | Backend API(s) Wired |
|---|---|---|---|
| **`/(auth)/index.tsx`** | Screen | **Google OAuth Sign-In Gateway:** Initiates native Google OAuth via `@react-native-google-signin/google-signin`, exchanges `id_token` with backend, validates session, and resolves student identity. Displays generic error box on rejection. | `POST /auth/mobile/login-id-token`<br>`GET /users/me` |
| **`/(app)/_layout.tsx`** | Layout | **Tab Shell & Role Guard:** Intercepts non-student accounts (`FACULTY_ADMIN`, `PLATFORM_ADMIN`, `FACULTY_MENTOR`) with an `[ACCESS_RESTRICTED]` screen. Mounts custom bottom tab bar with 3 tabs: `ATTENDANCE`, `HISTORY`, `PROFILE`. | `GET /users/me` |
| **`/(app)/index.tsx`** | Tab 1 | **Attendance & Home Feed:** Dynamically prioritizes live attendance sessions. If an active session is open for a registered event, it elevates an `ActiveAttendanceCard` with `[ SCAN QR / MARK ATTENDANCE ]` or `[ ATTENDANCE MARKED ]`. Below, it renders Ongoing Events (`LIVE` badge) and Upcoming Events. | Parallel calls:<br>`GET /v1/events`<br>`GET /v1/events/:id/sessions`<br>`GET /v1/users/me/registrations`<br>`GET /v1/users/me/attendance` |
| **`/(app)/events/[id]/index.tsx`** | Stack | **Event Detail:** Displays event title, venue, start date/time, registration count/capacity, and team size rules. Connects to SSE (`useEventLive`). Renders state-driven action tray (`OFFLINE`, `ORGANIZER — USE DESKTOP`, `LOCKED`, `ENDED`, `WAITING FOR SESSION`, `SCAN QR`). | `GET /v1/events/:id`<br>`GET /v1/events/:id/my-registration`<br>`GET /v1/events/:id/sessions`<br>`GET /v1/events/:id/live` (SSE) |
| **`/(app)/events/[id]/scan.tsx`** | Modal | **Ephemeral Camera & GPS Check-In:** Hardware camera viewfinder (`expo-camera`) with torch toggle, pre-fetching GPS coordinates (`expo-location`), and persistent hardware device ID (`getPersistentDeviceId()`). Submits cryptographic check-in. | `POST /v1/attendance/mark` |
| **`/(app)/events/[id]/teams.tsx`** | Stack | **Desktop Notice:** Informational view notifying students that team registration and roster administration must be performed on the desktop web app. | None (static notice) |
| **`/(app)/history.tsx`** | Tab 2 | **Attendance Ledger:** Paginated chronological history of session check-ins displaying `PRESENT` or `ABSENT` status badges. Includes top header shortcut to Claims & Disputes. | `GET /v1/users/me/attendance` |
| **`/(app)/history/[id].tsx`** | Stack | **Attendance Detail:** Inspects session check-in details for a specific event. Displays session timestamps, status, and direct CTA to `[ FILE DISPUTE ]` or view existing dispute resolution. | `GET /v1/events/:id`<br>`GET /v1/events/:id/sessions`<br>`GET /v1/users/me/attendance`<br>`GET /v1/attendance/disputes` |
| **`/(app)/disputes/index.tsx`** | Stack | **Claims & Disputes Ledger:** Summary status bar (`PENDING`, `APPROVED`, `REJECTED`) and paginated list of all filed attendance disputes. | `GET /v1/attendance/disputes` |
| **`/(app)/disputes/new.tsx`** | Stack | **Dispute Submission Form:** Allows students to write a detailed justification for an unrecorded attendance session and submit claim. | `POST /v1/attendance/disputes` |
| **`/(app)/disputes/submitted.tsx`**| Stack | **Confirmation Receipt:** Post-submission receipt with dispute reference ID and return action. | None |
| **`/(app)/disputes/[id].tsx`** | Stack | **Dispute Resolution Detail:** Displays full claim context, student justification, admin status, and administrative review notes. | Sourced from query params / query cache |
| **`/(app)/invitations.tsx`** | Stack | **Team Invitations List:** Displays pending team invitations sent by student team leaders. Allows inline `[ ACCEPT ]` and `[ DECLINE ]`. | `GET /users/me/team-invitations`<br>`POST /v1/teams/:id/invitations/:id/accept`<br>`POST /v1/teams/:id/invitations/:id/decline` |
| **`/(app)/notifications.tsx`** | Stack | **Notification Center:** Paginated notification inbox with unread status indicators. Real-time SSE updates (`/v1/notifications/live`), individual mark read, and bulk mark-all-read. | `GET /v1/notifications`<br>`GET /v1/notifications/live` (SSE)<br>`PATCH /v1/notifications/:id/read`<br>`PATCH /v1/notifications/read-all` |
| **`/(app)/profile.tsx`** | Tab 3 | **Student Identity:** Displays student name, email, global role, academic program code, graduation year, and active club affiliations/roles (`MEMBER`, `CORE_MEMBER`, `CLUB_ADMIN`). Quick navigation links to Preferences, Notifications, Logs, and Disputes. Secure logout dialog. | `GET /users/me` |
| **`/(app)/settings.tsx`** | Stack | **Settings & Theme:** 3-way appearance switcher (`LIGHT`, `DARK`, `SYSTEM`) and external link to university privacy policy. | Local storage (`expo-secure-store`) |

---

## 3. Global Student Capability Matrix (What Students CAN Access)

### 3.1 Mobile-Only Capabilities
These features are exclusive to mobile devices and do not exist on the web dashboard:
* **Hardware Camera QR Viewfinder:** Live scanning of dynamic, time-rotating TOTP tokens (`v1:<sessionId>:<totpToken>`).
* **High-Accuracy Geofencing Verification:** Foreground GPS coordinates (`latitude`, `longitude`, `accuracy`) acquired within a 60-second freshness window and verified against campus geofence polygons.
* **Hardware Device UUID Binding:** Secure, tamper-resistant device identity fetched via `expo-secure-store` to prevent proxy check-ins and device cloning.
* **Native Push Notification Synchronization:** Registration and device token updates via `POST /users/me/push-token`.

### 3.2 Shared Student Capabilities (Mobile & Web)
Capabilities accessible by enrolled students across both platforms:
* **SSO Authentication:** Google OAuth using `@adypu.edu.in` and `@newtonschool.co` accounts.
* **Event Discovery & Evaluation:** Viewing event schedules, venues, descriptions, capacities, and lock status.
* **Attendance History & Session Auditing:** Chronological ledger of session presence, timestamps, and missing records.
* **Attendance Dispute Management:** Submitting justifications for unrecorded sessions and tracking resolution (`PENDING`, `APPROVED`, `REJECTED`).
* **Team Invitation Acceptance:** Responding (`ACCEPT`/`DECLINE`) to invitations from team captains.
* **Real-Time Notification Inbox:** Receiving live alerts (team invites, waitlist promotions, dispute updates) via SSE.
* **Student Identity & Club Roster Visibility:** Viewing academic program, batch, and club memberships.

### 3.3 Desktop-Only Capabilities (Strictly Guarded Against Mobile)
Per system architecture, administrative and complex formation workflows are barred from mobile:
* **Event Creation, Lifecycle Approval, and Editing:** Restricted to club organizers and faculty on desktop.
* **Attendance Session Management & QR Projection:** Organizers launching sessions and displaying rotating QR codes.
* **Manual Attendance Overrides & CSV Exports:** Organizers marking attendance manually or exporting check-in sheets.
* **Team Creation & Searchable Roster Formation:** Searching students by email, creating teams, transferring leadership, or disbanding rosters.
* **Club Governance & Directory Administration:** Creating clubs, adding/removing members, or editing club profiles.

---

## 4. Immediate V1 Gap Analysis (What Must Be Added to Current Code)

The following items are defined in `docs/mobile/17-final-student-app-specification.md` but are incomplete or missing in the current `apps/mobile` codebase:

### Gap 1: Notification Preferences UI in `settings.tsx`
* **Current State:** `apps/mobile/src/hooks/use-notification-preferences.ts` is fully implemented and connects to `GET/PATCH /v1/notifications/preferences`. However, `apps/mobile/app/(app)/settings.tsx` only contains Appearance and Legal sections; the 4 toggles are missing from the screen.
* **Action Required:**
  - Import `useNotificationPreferences` into `settings.tsx`.
  - Add an **`ALERTS & NOTIFICATIONS`** section between `APPEARANCE` and `LEGAL`.
  - Add 4 Neo-Brutalist switches:
    1. `MASTER PUSH` (`push_enabled`) — when disabled, subordinate switches dim to `opacity: 0.4` and disable.
    2. `EVENT REMINDERS` (`event_reminders`) — alerts 15–30 mins before registered events.
    3. `CLUB UPDATES` (`club_announcements`) — broadcasts from enrolled clubs.
    4. `ATTENDANCE & CLAIMS` (`attendance_alerts`) — attendance session opens and dispute resolutions.

### Gap 2: Dual-State Domain Rejection & Escalation in `(auth)/index.tsx`
* **Current State:** `(auth)/index.tsx` renders a single generic error box with a "Try a different account" button.
* **Action Required:**
  - Parse error responses from `POST /auth/mobile/login-id-token`:
    1. **State A — Unsupported Domain (`INSTITUTIONAL_DOMAIN_NOT_ALLOWED`):**
       - Title: `INSTITUTIONAL DOMAIN NOT ALLOWED`
       - Message: *"NST Events is restricted to institutional accounts. Please sign in with your @adypu.edu.in or @newtonschool.co Google account."*
       - Action: `[ SWITCH GOOGLE ACCOUNT ]` (triggers `GoogleSignin.signOut()` and re-opens picker).
    2. **State B — Authorized Domain but Unlisted (`STUDENT_ACCESS_NOT_AUTHORIZED`):**
       - Title: `STUDENT NOT ENROLLED IN DIRECTORY`
       - Message: *"Account Recognized, but Not Enrolled: [email] is not listed in the active NST Student Directory."*
       - Primary Action: `[ SWITCH ACCOUNT ]`
       - Secondary Action: `[ Contact Academic Coordinator ]` opening a structured `mailto:` link:
         ```
         mailto:events-support@adypu.edu.in?subject=Student%20Directory%20Inquiry%20-%20[email]&body=Student%20Name:%0AProgram:%0ABatch%20Year:%0AStudent%20ID:%0AProblem:%20Institutional%20account%20not%20authorized%20in%20NST%20Events.
         ```

### Gap 3: Online-Only Attendance Guard in `scan.tsx` & `AttendanceFailureView.tsx`
* **Current State:** If network connectivity drops before or during scanning, generic errors or unhandled fetch exceptions can occur.
* **Action Required:**
  - Verify network connectivity (`useNetworkStatus`) in `scan.tsx` prior to camera activation and during submission.
  - On network drop, throw `NETWORK_OFFLINE`.
  - In `AttendanceFailureView.tsx`, add a specific `NETWORK_OFFLINE` case:
    - Title: `Network Required`
    - Reason: `An active network connection is required to verify attendance.`
    - Action: `Please connect to campus Wi-Fi or mobile data and try again.`

### Gap 4: Deep Linking from Notification Center (`notifications.tsx`)
* **Current State:** Tapping a notification card only marks it as read. It does not route anywhere.
* **Action Required:**
  - Parse `notification.metadata` or `notification.type`:
    - Team invitations (`type === 'TEAM_INVITATION'` or metadata has `invitationId`) → navigate to `/(app)/invitations`.
    - Event updates (`type === 'EVENT_UPDATE'`, `eventId` in metadata) → navigate to `/(app)/events/[id]`.
    - Attendance/Dispute alerts (`disputeId` in metadata) → navigate to `/(app)/disputes/[id]`.

---

## 5. Proposed Feature Roadmap (Things to Add in Mobile)

These features are either documented in earlier UX specifications (`nst-events-student-ux-spec.md`, `ux/student/*`) or supported by existing backend endpoints in `02-api-routing-matrix.md`, but not yet present in the mobile application.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MOBILE FEATURE EXPANSION MAP                          │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│    DISCOVER & SEARCH  │    LEADERBOARD & RANKS      │   CLUBS & ROSTERS     │
│  - TSVector Search    │  - Campus Student Leaderbd  │ - Campus Club List    │
│  - EventType Chips    │  - Total Points & Rank Pill │ - Club Profile Screen │
│  - "My Clubs" Filter  │  - Materialized View Sync   │ - Read-only Team View │
└───────────────────────┴─────────────────────────────┴───────────────────────┘
```

### Feature 1: Discover Feed & Event Filtering (Campus Tab / Home Search)
* **User Value:** Currently, students only see a flat list of upcoming events. They cannot search or filter by category.
* **Backend Endpoint:** `GET /v1/events` (supports query params: `search`, `club_id`, `type`, `page`).
* **UI Additions:**
  - Search bar supporting instant filtering against event titles and descriptions.
  - Horizontal scrollable filter chips: `ALL`, `MY CLUBS`, plus `EventType` chips (`WORKSHOP`, `COMPETITION`, `HACKATHON`, `GUEST_SPEAKER`, `CLUB_MEETING`).
  - Pull-to-refresh and pagination for large event catalogs.

### Feature 2: Student Leaderboard Screen (`GET /v1/leaderboard/students`)
* **User Value:** Campus engagement and gamification. Allows students to see where they stand among peers.
* **Backend Endpoint:** `GET /v1/leaderboard/students` (returns `user_id`, `display_name`, `total_points`, `last_refreshed_at`).
* **UI Additions:**
  - Dedicated Leaderboard view (e.g. reachable via Profile menu or Campus segment).
  - Neo-Brutalist leaderboard cards displaying Student Rank (`#1`, `#2`), Display Name, and Total Points.
  - Sticky "My Rank" card pinned at the top showing the current student's personal placement.
  - *(Note: Points sub-breakdowns for attendance/contribution/competition are hardcoded to 0 in the backend materialized view per `DATA_CONTRACT.md:226`; UI must display `total_points` only).*

### Feature 3: Club Directory & Club Profile Screens (`GET /clubs`, `GET /clubs/:id`)
* **User Value:** Students can discover student clubs on campus, understand what they do, see member leaders, and browse all events organized by that club.
* **Backend Endpoints:**
  - `GET /clubs` — returns active clubs, `banner_url`, `event_count`, `member_count`.
  - `GET /clubs/:id` — returns club description, banner, members list with roles, and hosted events.
* **UI Additions:**
  - Club Directory screen with search and club cards.
  - Club Profile screen (`/clubs/[id]`) showing club banner, description, leadership roster badges (`CLUB_ADMIN`, `CORE_MEMBER`), and a list of upcoming events hosted by the club.
  - Tapping club badges in `profile.tsx` routes directly to the respective Club Profile.

### Feature 4: In-App Solo Event Registration & Cancellation
* **User Value:** Currently, students must switch to a desktop web browser to click "Register" or "Cancel Registration". The mobile app only shows read-only status (`STATUS: NOT REGISTERED`).
* **Backend Endpoints:**
  - `POST /v1/events/:id/register` — registers student (or places them on waitlist if full).
  - `DELETE /v1/events/:id/register` — cancels solo registration if event is unlocked.
* **Code Readiness:** `useRegistration` hook is **already written** in `apps/mobile/src/hooks/use-registration.ts` with full optimistic cache invalidation and toast feedback.
* **UI Additions:**
  - When `regStatus === 'NOT_REGISTERED'` and event is open, render `[ REGISTER FOR EVENT ]` button with a confirmation dialog.
  - When `regStatus === 'REGISTERED'` and event is not locked, offer a `[ CANCEL REGISTRATION ]` option with confirmation dialog.
  - Handle full capacity by notifying student: *"Event at capacity. You will be added to the waitlist."*

### Feature 5: Read-Only Team Roster & Teammate View (`GET /v1/events/:id/teams`)
* **User Value:** For team-based events (hackathons, case competitions), students who have accepted invites or formed teams currently see a blank notice screen on mobile (`/events/[id]/teams.tsx`). They cannot verify who is on their team.
* **Backend Endpoint:** `GET /v1/events/:id/teams` (returns team name, `leader_name`, `member_count`, and `members[]`).
* **UI Additions:**
  - Replace the blank placeholder with a view of the student's registered team.
  - Display Team Name, Team Captain indicator, and list of teammates with status (`REGISTERED`, `PENDING_INVITE`).
  - Retain the rule that team *mutations* (invite sending, leader transfer, disbanding) are desktop-only, but provide full read visibility.

### Feature 6: First-Time User Onboarding Checklist Stack
* **User Value:** Accelerates onboarding for new students logging in for the first time.
* **Spec Reference:** `nst-events-student-ux-spec.md:207-214`.
* **UI Additions:**
  - A dismissible 3-card stack at the top of the Home feed for new profiles:
    1. **Verify Academic Profile:** Ensure Program, Batch, and Semester are accurate.
    2. **Explore Campus Clubs:** Deep-link to club affiliations.
    3. **Enable Push Notifications:** Deep-link to Notification Preferences.
  - Auto-dismisses cards as actions are completed.

### Feature 7: Offline Attendance Sync Queue (`POST /v1/attendance/sync-offline`)
* **User Value:** High-density indoor campus venues often experience cellular congestion or Wi-Fi drops during massive auditoriums check-ins.
* **Backend Endpoint:** `POST /v1/attendance/sync-offline` (already implemented in backend `attendanceRouter:49`).
* **Status:** Formally deferred for V1 in `17-final-student-app-specification.md:357`, but planned for V2.
* **Implementation Concept:**
  - Encrypt and buffer scanned QR payloads + GPS fix in a local FIFO SQLite / SecureStore queue when offline.
  - Synchronize automatically when network connection is restored.

---

## 6. Documentation Conflicts & Specification Gaps (Mandatory Citations)

In compliance with repository operating principles, the following documentation conflicts and specification gaps are formally logged:

### Conflict 1: Bottom Navigation Architecture (3-Tab Shell)
* **Citation A:** `nst-events-student-ux-spec.md:13-19` and `nst-events-student-design-system.md:58`
  - Defines the 3 bottom tabs as: **`Home`**, **`Campus`**, and **`Profile`**.
  - Explicitly states: *"Scan is not a tab. Per docs/mobile/05-home-screen-architecture.md, the QR scanner is an ephemeral modal..."*
* **Citation B:** `docs/mobile/17-final-student-app-specification.md:114-121` and `docs/frontend/mobile/IMPLEMENTATION_CONTRACT.md:16`
  - Defines the 3 bottom tabs as: **`ATTENDANCE`**, **`HISTORY`**, and **`PROFILE`**.
  - Omits `Campus` from bottom navigation and promotes `HISTORY` to a permanent tab.
* **Code Reality:** `apps/mobile/app/(app)/_layout.tsx` currently implements Citation B (`index` / ATTENDANCE, `history` / HISTORY, `profile` / PROFILE).

### Design System Resolution: Confirmed Neo-Brutalist (Zero M3)
* **Design Standard:** The student frontend design system is frozen to the active **Neo-Brutalist Kinetic Noir / Stark Light** implementation ([nst-events-student-design-system.md](file:///Users/sohamdhande/Docs_Local/nst-events/nst-events-student-design-system.md) and `apps/mobile/src/ui/theme.ts`).
* **Design Traits:** Sharp rectangular edges (`borderRadius: 0`), high-contrast 1px solid borders, Syne / Inter / JetBrains Mono typography, bracketed status badges (`[PRESENT]`, `[LIVE NOW]`), and dense data matrices.
* **M3 Discarded:** All legacy proposals, libraries, or tokens referencing Material Design 3 (M3), rounded pill shapes, or Gaussian drop shadows are completely removed from the student specification.

### Conflict 3: Solo Event Registration on Mobile
* **Citation A:** `nst-events-student-ux-spec.md:47, 87-97`
  - *"Solo registration flow (with confirm dialog — DECIDED)"*
* **Citation B:** `docs/mobile/17-final-student-app-specification.md:66, 331`
  - *"Event Registration & Cancellation Mutations: Performing solo event registration or cancellation. Mobile only displays read-only registration status."*
* **Code Reality:** `apps/mobile/src/hooks/use-registration.ts` has the mutation written, but `events/[id]/index.tsx` hides the register button and displays `STATUS: NOT REGISTERED`.

### Conflict 4: Domain Rejection Support / Escalation
* **Citation A:** `nst-events-student-ux-spec.md:198-200`
  - *"Domain-rejected support path → single CTA, no live support channel... No 'Contact Admin' link — a login screen is the wrong place to open a support ticket flow..."*
* **Citation B:** `docs/mobile/17-final-student-app-specification.md:155-176`
  - State B provides `[ Contact Academic Coordinator ]` opening a structured `mailto:` link to `events-support@adypu.edu.in`.
* **Code Reality:** `(auth)/index.tsx` currently displays Citation A (single "Try a different account" CTA).

### Specification Gaps
1. **Student Leaderboard Breakdown:** Backend materialized view hardcodes `attendance_points`, `contribution_points`, and `competition_points` to `0` (`DATA_CONTRACT.md:226`). Only `total_points` is authoritative.
2. **Team Association in Self-Registration:** `GET /v1/events/:id/my-registration` only returns `{ status: "REGISTERED" }` and does **not** return `team_id` (`DATA_CONTRACT.md:98`). Mobile cannot directly deduce which team the user belongs to without cross-referencing `GET /v1/events/:id/teams`.

---

## 7. Implementation Phasing & Priority Matrix

| Phase | Target | Features & Changes | Scope |
|---|---|---|---|
| **Phase 1: V1 Freeze Completion** *(COMPLETED)* | `apps/mobile` | • Wire 4-toggle Notification Preferences in `settings.tsx` [DONE]<br>• Differentiate Domain Rejection & add `mailto:` in `(auth)/index.tsx` [DONE]<br>• Implement network offline guard in `scan.tsx` & `AttendanceFailureView.tsx` [DONE]<br>• Wire notification card deep linking in `notifications.tsx` [DONE]<br>• iOS-parity 8-spoke ActivityIndicator with discrete stepping on Android [DONE] | Fixes current spec gaps; 0 new routes. |
| **Phase 2: Core Participation Expansion** | `apps/mobile` | • Enable In-App Solo Registration & Cancellation in `events/[id]/index.tsx`<br>• Implement Event Search & EventType Filter Chips on Home Feed<br>• Add Read-Only Team Roster inspection in `events/[id]/teams.tsx` | High student UX value; uses existing APIs. |
| **Phase 3: Campus Exploration & Community** | `apps/mobile` | • Add Student Leaderboard view (`/leaderboard`)<br>• Add Campus Clubs Directory (`/clubs`) & Club Profile (`/clubs/[id]`)<br>• Add Onboarding Checklist cards on Home for new accounts | Adds community depth and exploration. |
| **Phase 4: Resilient In-Person Attendance** *(V2)* | `apps/mobile` | • Offline Attendance FIFO sync buffer (`POST /v1/attendance/sync-offline`)<br>• Enhanced haptic & audio feedback on TOTP scan completion | Resiliency in offline campus venues. |

---

## 8. Summary & Recommended Next Steps

1. **Complete Phase 1 immediately:** Align `settings.tsx`, `(auth)/index.tsx`, `scan.tsx`, and `notifications.tsx` with the accepted V1 freeze specifications.
2. **Product Alignment on Solo Registration:** Confirm whether product wants to allow in-app solo registration (enabling `useRegistration` in `events/[id]/index.tsx`) or maintain strict desktop exclusivity.
3. **Product Alignment on Navigation Shell:** Confirm whether the bottom navigation should remain `ATTENDANCE / HISTORY / PROFILE` (V1 Freeze standard) or incorporate `CAMPUS` (Discover/Leaderboard/Clubs) as outlined in `nst-events-student-ux-spec.md`.
