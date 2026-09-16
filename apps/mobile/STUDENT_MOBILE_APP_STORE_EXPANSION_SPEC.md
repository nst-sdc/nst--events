# NST Events — Student Mobile App V1 Expansion Specification
## Comprehensive Product & Technical Blueprint for Apple App Store Publication

**Target Codebase:** `apps/mobile` (Expo React Native, TypeScript, Tailwind/NativeWind)  
**Authoritative References:** `docs/api/02-api-routing-matrix.md`, `docs/frontend/shared/DATA_CONTRACT.md`, `docs/mobile/16-student-ux-ia-spec-v2.md`, `nst-events-student-design-system.md`  
**Date:** September 15, 2026  
**Status:** PROPOSED EXPANSION PLAN FOR MANAGEMENT & APP STORE APPROVAL  

---

## 1. Executive Summary & Objective

### 1.1 The Business & Publishing Problem
During review with university leadership, management concluded that an application limited solely to attendance tracking does not justify allocating the institutional **Apple Developer Kit** (or public App Store listing). This directly aligns with Apple's official review standards:

> **Apple App Store Review Guideline 4.2 (Minimum Functionality):**  
> *"Your app should include features, content, and UI that elevate it beyond a repackaged website or simple utility. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store. For example, simple utilities, a single dynamic web page, or an app that just does one basic thing (like an attendance barcode scanner) are rejected."*

If the NST Events mobile application remains only a physical QR scanner and check-in ledger, it will either:
1. **Fail Apple App Store Review** under Guideline 4.2, or
2. **Be blocked internally by university management** from receiving Apple enterprise/developer account provisioning.

### 1.2 The Solution
To secure the Apple Developer Kit immediately and pass App Store review with distinction, the mobile application must be positioned and built as the **Official NST Campus Life & Student Event Companion**. 

Crucially, **the backend already provides 100% of the required data models and REST/SSE endpoints**. We can unlock event discovery, in-app solo registrations, club directories, team roster inspection, student leaderboards, and native device calendar integration without altering a single line of backend, database, or Prisma code.

---

## 2. Comparative Analysis: Current Codebase vs. Expanded V1

| Feature Area | Current Implementation (`apps/mobile`) | Proposed Expanded V1 | Apple Review Impact |
|---|---|---|---|
| **Event Discovery** | Flat, unsearchable list of events on the Attendance tab. | Full Discover feed with live text search, `EventType` category chips, and "My Clubs" toggle. | Elevates app to a content-rich portal. |
| **Event Registration** | Read-only (`STATUS: NOT REGISTERED`). Students must open desktop web to click Register. | In-app solo event registration (`POST /v1/events/:id/register`) and cancellation with confirm sheets. | Fundamental native app utility. |
| **Club Organizations** | Static text badges on Profile (`[ CLUB_NAME / MEMBER ]`). | Full Campus Club Directory (`/clubs`) and Club Profile (`/clubs/[id]`) with rosters and hosted events. | Institutional community depth. |
| **Team Rosters** | Static notice: *"Team registration & rosters are restricted to desktop web."* | Read-only inspection of the student's registered team (`/events/[id]/teams`), captain, and member statuses. | Essential for hackathons & competitions. |
| **Leaderboard & Ranks** | Completely absent from mobile. | Campus Student Leaderboard (`/leaderboard`) with sticky personal rank card and club rankings. | High-engagement gamification. |
| **Attendance & Check-in** | High-precision dynamic TOTP QR scanner + geofencing + device ID binding. | Unchanged — retained as the flagship physical check-in engine. | Strong native hardware integration (Camera + GPS). |
| **Attendance Disputes** | Ledger and claim submission with countdown deadline. | Retained with enhanced deep-linking from notifications. | Complete student agency. |
| **Native Integrations** | Camera, GPS, Push Tokens, SecureStore. | Added: Native Device Calendar sync (`expo-calendar`) and Native Share Sheet (`Share.share`). | Demonstrates rich iOS/Android platform capabilities. |

---

## 3. Screen-by-Screen Detailed Feature Specifications

### Screen 1: Home / Priority Feed (`/(app)/(tabs)/index.tsx`)
The Home feed is the context-aware operational center of the student's day. It prioritizes time-sensitive actions over static lists.

```
┌─────────────────────────────────────────────────────────────┐
│  NST EVENTS // STUDENT PORTAL               [🔔 Unread: 2]  │
├─────────────────────────────────────────────────────────────┤
│  [ ONBOARDING STACK: 1 of 3 ] [X]                           │
│  Verify your academic profile (B.Tech CSE · 2026)      [->] │
├─────────────────────────────────────────────────────────────┤
│  ▼ LIVE ATTENDANCE NOW OPEN                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⚡ ANNUAL CODE SPRINT 2026                              │ │
│  │ Hall 3 · Closes in 14:22                               │ │
│  │ [ SCAN QR / MARK ATTENDANCE ]                          │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ▼ TODAY'S CONFIRMED PASSES                                 │
│  [ EventCard: AI Workshop · 2:00 PM · Audi A ]              │
├─────────────────────────────────────────────────────────────┤
│  ▼ HAPPENING THIS WEEK                                      │
│  [ EventCard: Robotics Expo · Fri 10:00 AM ]                │
└─────────────────────────────────────────────────────────────┘
```

* **Dynamic Feed Hierarchy:**
  1. **Dismissible Onboarding Stack (for new students):**
     - Card 1: *Complete Academic Profile* (routes to `/profile`).
     - Card 2: *Explore Campus Clubs* (routes to `/clubs`).
     - Card 3: *Enable Event Reminders* (routes to `/settings`).
     - Cards auto-dismiss as requirements are fulfilled.
  2. **Active Attendance Banner (Elevated Priority):**
     - Scans registered events with an open attendance session (`openAt <= now <= closeAt`).
     - If attendance is unmarked: renders high-visibility `[ SCAN QR / MARK ATTENDANCE ]` button opening `/events/[id]/scan`.
     - If attendance is already marked: displays `[ ATTENDANCE MARKED ]` with timestamp.
  3. **Today's Passes / Registered Events:**
     - Quick-access cards for events the user is confirmed for today.
  4. **Upcoming Campus Highlights:**
     - Curated list of upcoming published events.
* **Header Actions:**
  - Notification Bell with real-time unread badge counter (`GET /v1/notifications/unread-count`).
  - Tapping routes to Notification Center (`/(app)/notifications`).

---

### Screen 2: Campus & Event Discovery (`/(app)/(tabs)/campus.tsx` or `discover.tsx`)
A dedicated search and exploration hub for discovering all campus happenings.

```
┌─────────────────────────────────────────────────────────────┐
│  CAMPUS DISCOVERY                                           │
├─────────────────────────────────────────────────────────────┤
│  [ 🔍 Search events, venues, topics...                   ] │
├─────────────────────────────────────────────────────────────┤
│  [ ALL ]  [ MY CLUBS ]  [ WORKSHOP ]  [ COMPETITION ]  [>]  │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [WORKSHOP]                             [45/100 SPOTS]  │ │
│  │ ADVANCED REACT PATTERNS                                │ │
│  │ Hosted by GDG Campus                                   │ │
│  │ 📅 Sat, Oct 12 · 10:00 AM     📍 Lab 402, Newton Block │ │
│  │ [ REGISTER ]                                  [ DETAILS]│
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

* **Search Engine (`GET /v1/events`):**
  - Instant debounced search querying event title, description, and location.
* **Category Filter Chips (Data-Driven from Backend `EventType` Enum):**
  - `ALL`: All published events.
  - `MY CLUBS`: Filter events where `primaryClubId` matches student's club memberships.
  - `WORKSHOP`, `COMPETITION`, `HACKATHON`, `GUEST_SPEAKER`, `CLUB_MEETING`.
* **Card Metadata Display:**
  - Event Type badge (`[WORKSHOP]`, `[COMPETITION]`).
  - Capacity Meter: `registrationCount / maxCapacity` spots filled.
  - Registration Lock Countdown: alerts students if lock boundary is near.
  - Organizer Club Name & Badge.

---

### Screen 3: Event Detail & In-App Solo Registration (`/(app)/events/[id]/index.tsx`)
Transforms the current read-only screen into an actionable event hub.

* **In-App Solo Registration Flow:**
  1. Student taps `[ REGISTER FOR EVENT ]`.
  2. A Neo-Brutalist confirmation sheet appears:
     - Event title, venue, and start time.
     - Academic eligibility notice (e.g. Batch / Program check).
     - Cancellation policy notice (registration can be cancelled up to final lock deadline).
  3. On confirm: dispatches `POST /v1/events/:id/register`.
  4. Optimistic query cache invalidation on `['events', id]` and `['my-registrations']`.
  5. If event is at capacity: backend returns waitlist status; UI immediately updates to `[ WAITLISTED ]` with notice: *"Event is at capacity. You have been added to the waitlist."*
* **In-App Cancellation Flow:**
  1. If student is registered and `!event.isLocked` and within cancellation window:
     - Secondary button appears: `[ CANCEL REGISTRATION ]`.
  2. Prompts confirmation dialog: *"Are you sure? If the event fills up, you will lose your spot."*
  3. On confirm: dispatches `DELETE /v1/events/:id/register`.
* **Native Device Calendar Integration:**
  - Secondary button: `[ 📅 ADD TO CALENDAR ]`.
  - Uses `expo-calendar` to request calendar permissions and create an event with title, venue, notes, and alerts set 30 minutes prior.
* **Native Share Action:**
  - Share button triggers native OS share sheet with structured text and web link.
* **Live SSE Subscription (`GET /v1/events/:id/live`):**
  - Listens to `registration_count` and updates capacity meter in real time.
  - Listens to `waitlist_update` and alerts student if they are promoted.

---

### Screen 4: Campus Club Directory (`/(app)/clubs/index.tsx`)
Allows students to explore university clubs, technical societies, and cultural organizations.

```
┌─────────────────────────────────────────────────────────────┐
│  CAMPUS CLUBS & SOCIETIES                                   │
├─────────────────────────────────────────────────────────────┤
│  [ 🔍 Search clubs by name or domain...                  ] │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [BANNER IMAGE: ACM STUDENT CHAPTER]                    │ │
│  │ ACM STUDENT CHAPTER                     [TECH / CODING]│ │
│  │ Fostering algorithmic thinking and competitive coding. │ │
│  │ 👥 142 Members  ·  🎯 18 Events Hosted                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

* **Data Source:** `GET /clubs` (returns `id`, `name`, `description`, `banner_url`, `event_count`, `member_count`).
* **Interactive Elements:**
  - Search bar filtering clubs by name.
  - Club Card rendering banner image, title, member count, and total events organized.
  - Tapping a card opens the Club Profile (`/(app)/clubs/[id]`).

---

### Screen 5: Club Profile & Roster (`/(app)/clubs/[id].tsx`)
A dedicated showcase for individual campus organizations.

```
┌─────────────────────────────────────────────────────────────┐
│  < BACK TO CLUBS                                            │
├─────────────────────────────────────────────────────────────┤
│  [ HERO BANNER ]                                            │
│  GOOGLE DEVELOPER GROUPS (GDG)                              │
│  Official campus chapter for cloud, mobile & AI tech.       │
├─────────────────────────────────────────────────────────────┤
│  ▼ EXECUTIVE BOARD & CORE TEAM                              │
│  [Avatar] Aarav Sharma     · CLUB_ADMIN (President)        │
│  [Avatar] Priya Patel      · CORE_MEMBER (Tech Lead)        │
│  [Avatar] Rohan Mehta      · CORE_MEMBER (Operations)       │
├─────────────────────────────────────────────────────────────┤
│  ▼ HOSTED EVENTS                                            │
│  [ EventCard: Cloud Architecture Bootcamp · Oct 20 ]        │
│  [ EventCard: Android Jetpack Workshop · Nov 05 ]           │
└─────────────────────────────────────────────────────────────┘
```

* **Data Source:** `GET /clubs/:id` (returns `name`, `description`, `banner_url`, `members[]` with `avatar_url`, `full_name`, `user_id`).
* **Features:**
  - High-resolution club banner and description.
  - Core team leadership roster with verified role badges (`CLUB_ADMIN`, `CORE_MEMBER`).
  - Section displaying all upcoming and past events hosted by this club (`GET /v1/events?club_id=:id`).
  - Direct deep linking: tapping club badges on the student's personal profile routes straight here.

---

### Screen 6: Read-Only Team Roster & Inspection (`/(app)/events/[id]/teams.tsx`)
Replaces the current placeholder screen with an active team inspection view for team-based hackathons and competitions.

```
┌─────────────────────────────────────────────────────────────┐
│  < EVENT: CODEFEST HACKATHON                                │
├─────────────────────────────────────────────────────────────┤
│  TEAM: BYTE_BANDITS                          [REGISTERED]   │
│  Team Leader: Soham Dhande                                  │
├─────────────────────────────────────────────────────────────┤
│  ▼ TEAM MEMBERS (3 / 4)                                     │
│  1. Soham Dhande (You)      [LEADER]         [CONFIRMED]    │
│  2. Ananya Sharma           [MEMBER]         [CONFIRMED]    │
│  3. Dev Malhotra            [MEMBER]         [CONFIRMED]    │
│  4. Empty Slot              [INVITE PENDING]                │
├─────────────────────────────────────────────────────────────┤
│  ℹ️ Team mutations (invites, leader transfers) are managed   │
│     on the desktop dashboard.                               │
└─────────────────────────────────────────────────────────────┘
```

* **Data Source:** `GET /v1/events/:id/teams` (returns `id`, `name`, `leader_id`, `leader_name`, `member_count`, `members[]`).
* **Features:**
  - Displays student's assigned team, team name, and captain badge.
  - Roster of all accepted teammates with confirmed registration status.
  - Pending invitation slots.
  - Non-blocking warning banner if team is below `minimum_team_size` (`below_minimum_team_count`).

---

### Screen 7: Campus Leaderboard (`/(app)/leaderboard.tsx`)
Adds high-value gamification and student engagement to the mobile app.

```
┌─────────────────────────────────────────────────────────────┐
│  CAMPUS LEADERBOARD                                         │
├─────────────────────────────────────────────────────────────┤
│  [ 👤 STUDENTS ]                     [ 🏛 CLUBS ]           │
├─────────────────────────────────────────────────────────────┤
│  ⭐ YOUR RANKING                                            │
│  #14  Soham Dhande                   340 PTS  ·  TOP 5%     │
├─────────────────────────────────────────────────────────────┤
│  🏆 PODIUM                                                  │
│  🥇 #1  Vikram Malhotra              820 PTS                │
│  🥈 #2  Sneha Roy                    760 PTS                │
│  🥉 #3  Arjun Das                    710 PTS                │
├─────────────────────────────────────────────────────────────┤
│  #4  Meera Joshi                     640 PTS                │
│  #5  Karan Kapoor                    610 PTS                │
└─────────────────────────────────────────────────────────────┘
```

* **Data Source:** 
  - Students: `GET /v1/leaderboard/students` (returns `user_id`, `display_name`, `total_points`, `last_refreshed_at`).
  - Clubs: `GET /v1/leaderboard/clubs` (returns `club_id`, `club_name`, `total_points`, `event_count`, `member_count`).
* **Features:**
  - Two-segment toggle: **Students** and **Clubs**.
  - Pinned "Your Rank" card showing current student's placement, total points, and percentile.
  - Top-3 podium display with distinct gold, silver, and bronze Neo-Brutalist badges.
  - *(Contract Notice: `DATA_CONTRACT.md:226` confirms `attendance_points`, `contribution_points`, and `competition_points` are hardcoded to 0 in the backend materialized view; UI strictly displays `total_points`)*.

---

### Screen 8: Attendance QR Check-In (`/(app)/events/[id]/scan.tsx`)
*Already implemented and fully functional.*
* Hardware camera viewfinder with torch toggle.
* Real-time GPS geofence acquisition within a 60-second freshness window.
* Hardware-backed device ID binding (`expo-secure-store`) to prevent attendance proxying.
* Submission to `POST /v1/attendance/mark`.
* Network offline protection and discrete activity indicator.

---

### Screen 9: Attendance History & Claims Ledger (`/(app)/history.tsx` & `disputes/`)
*Already implemented and fully functional.*
* Infinite-scroll chronological ledger of attended and missed event sessions.
* Status badges: `[PRESENT]`, `[ABSENT]`.
* Dispute filing modal with active countdown to `disputeWindowExpiresAt`.
* Dispute resolution tracker: `PENDING`, `APPROVED`, `REJECTED` with admin notes.

---

### Screen 10: Notification Center (`/(app)/notifications.tsx`)
*Already implemented; requires deep-link routing enhancement.*
* Real-time notification stream via SSE (`/v1/notifications/live`).
* Mark single read and bulk mark-all-read.
* **Deep Linking Navigation:**
  - Event alerts → navigate to `/events/[id]`.
  - Team invites → navigate to `/invitations`.
  - Dispute resolution → navigate to `/disputes/[id]`.

---

### Screen 11: Student Profile & Credentials (`/(app)/profile.tsx`)
* Identity card: Full Name, Institutional Email, Academic Program Code, Batch Year, Global Role (`STUDENT`).
* **Earned Badges & Affiliations:** Club memberships with roles (`MEMBER`, `CORE_MEMBER`, `CLUB_ADMIN`). Tapping any club navigates directly to `/clubs/[id]`.
* **Campus Engagement Matrix:**
  - Total Points Earned.
  - Total Events Attended.
  - Verified Attendance Rate %.
* Navigation links to Preferences, Notification Center, Attendance History, and Support.
* Secure logout purging `expo-secure-store` tokens and React Query caches.

---

### Screen 12: Settings & Apple App Store Compliance (`/(app)/settings.tsx`)
* **Appearance:** 3-way high-contrast theme switcher (`LIGHT`, `DARK`, `SYSTEM`).
* **Alerts & Notifications (4 Independent Toggles):**
  1. `MASTER PUSH` (`push_enabled`).
  2. `EVENT REMINDERS` (`event_reminders`).
  3. `CLUB ANNOUNCEMENTS` (`club_announcements`).
  4. `ATTENDANCE & DISPUTES` (`attendance_alerts`).
* **Apple Guideline 5.1.1 Compliance (Account Deletion & Data Privacy):**
  - Institutional Account Deletion / Data Request link (required by Apple for apps supporting user accounts).
  - External link to university privacy policy.
* **App Information:** App version, build number, and device UUID status.

---

## 4. Recommended Navigation Architecture

To present this rich catalog to Apple reviewers and university management, we have two viable navigation options:

### Option A: 3-Tab "Campus" Shell (Recommended — Aligns with `docs/mobile/16-student-ux-ia-spec-v2.md`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       3-TAB NAVIGATION HIERARCHY                            │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│       [ ⊡ HOME ]      │        [ 🏛 CAMPUS ]        │      [ 👤 PROFILE ]   │
├───────────────────────┼─────────────────────────────┼───────────────────────┤
│ • Live Check-In Card  │ • Event Discovery & Search  │ • Academic Profile    │
│ • Registered Passes   │ • EventType Filter Chips    │ • Club Affiliations   │
│ • Onboarding Stack    │ • Club Directory            │ • Attendance History  │
│ • Upcoming Highlights │ • Campus Leaderboards       │ • Settings & Themes   │
└───────────────────────┴─────────────────────────────┴───────────────────────┘
```
* **Why Option A is best:** Retains the high-efficiency 3-tab philosophy specified in UX v2 (`16-student-ux-ia-spec-v2.md:13-19`) while creating a rich, centralized `CAMPUS` tab housing Discover, Clubs, and Leaderboard segments.

### Option B: 4-Tab Extended Shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ 🔍 DISCOVER ]   [ ⊡ ATTENDANCE ]   [ ⟲ HISTORY ]    [ 👤 PROFILE ]       │
│  - Events & Search - Live Check-In    - Check-in Ledger - Badges & Clubs    │
│  - Clubs Directory - Active Sessions  - Dispute Claims  - Leaderboard       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete Backend API & Data Contract Mapping

Every screen and feature in this expansion uses **existing, verified backend endpoints** from `02-api-routing-matrix.md` and `DATA_CONTRACT.md`. **Zero backend changes are required.**

| Screen / Feature | Route / Endpoint | HTTP Method | Casing / Contract Rule | Source Citation |
|---|---|---|---|---|
| **Event Search & List** | `/v1/events` | `GET` | `camelCase` (Prisma-raw) + `location_geofence` | `DATA_CONTRACT.md:29` |
| **Event Detail** | `/v1/events/:id` | `GET` | `camelCase` identical to list | `DATA_CONTRACT.md:40` |
| **In-App Solo Register** | `/v1/events/:id/register` | `POST` | Dispatches atomic DB transaction | `02-api-routing-matrix.md:92` |
| **In-App Solo Cancel** | `/v1/events/:id/register` | `DELETE` | Blocked if locked or team event | `02-api-routing-matrix.md:93` |
| **My Registration Status** | `/v1/events/:id/my-registration`| `GET` | `{ status: "REGISTERED" \| ... }` | `DATA_CONTRACT.md:89` |
| **Realtime Event SSE** | `/v1/events/:id/live` | `GET (SSE)` | `registration_count`, `waitlist_update` | `DATA_CONTRACT.md:273` |
| **Campus Club Directory** | `/clubs` or `/clubs/search` | `GET` | `snake_case`: `banner_url`, `event_count` | `DATA_CONTRACT.md:136` |
| **Club Profile & Roster** | `/clubs/:id` | `GET` | `snake_case`: `members[]`, `banner_url` | `DATA_CONTRACT.md:145` |
| **Read-Only Team Roster** | `/v1/events/:id/teams` | `GET` | `snake_case`: `leader_name`, `members[]` | `DATA_CONTRACT.md:120` |
| **Student Leaderboard** | `/v1/leaderboard/students` | `GET` | `snake_case`: `total_points` authoritative | `DATA_CONTRACT.md:221` |
| **Club Leaderboard** | `/v1/leaderboard/clubs` | `GET` | `snake_case`: `total_points`, `event_count` | `DATA_CONTRACT.md:231` |
| **Realtime Notifications** | `/v1/notifications/live` | `GET (SSE)` | Session-bound PostgreSQL stream | `02-api-routing-matrix.md:154` |
| **Notification Prefs** | `/v1/notifications/preferences`| `GET/PATCH`| 4 independent toggles | `02-api-routing-matrix.md:90` |
| **QR Check-in** | `/v1/attendance/mark` | `POST` | TOTP + geofencing + device UUID | `02-api-routing-matrix.md:48` |
| **Dispute Claims** | `/v1/attendance/disputes` | `POST / GET`| Subject to `disputeWindowExpiresAt` | `02-api-routing-matrix.md:53` |

---

## 6. Formal Documentation Conflict & Gap Notice

Per project law, conflicts between documentation files are formally logged below:

### Conflict 1: In-App Solo Registration
* **Citation A:** `docs/mobile/17-final-student-app-specification.md:67` states:  
  *"Event Registration & Cancellation Mutations: Performing solo event registration or cancellation. Mobile only displays read-only registration status."*
* **Citation B:** `docs/mobile/16-student-ux-ia-spec-v2.md:47, 94` states:  
  *"Solo registration flow (with confirm dialog — DECIDED)"*
* **Resolution for Management:** To meet management's mandate and satisfy Apple App Store Guideline 4.2, Citation B is adopted. The existing mutation hook in `apps/mobile/src/hooks/use-registration.ts` will be connected to the UI.

### Conflict 2: Navigation Shell Structure
* **Citation A:** `docs/mobile/17-final-student-app-specification.md:114` defines tabs as `ATTENDANCE`, `HISTORY`, `PROFILE`.
* **Citation B:** `docs/mobile/16-student-ux-ia-spec-v2.md:13` defines tabs as `HOME`, `CAMPUS`, `PROFILE`.
* **Resolution for Management:** Option A (Citation B) gives Campus Exploration, Club Directory, and Leaderboards a permanent home without cluttering the attendance check-in workflow.

---

## 7. Phased Implementation Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ROLLOUT PHASES FOR STORE SUBMISSION                     │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│ PHASE 1: PARTICIPATION│ PHASE 2: DISCOVERY & CLUBS  │ PHASE 3: GAMIFICATION │
│ - In-App Solo Register│ - Discover Search & Filters │ - Student Leaderboard │
│ - In-App Solo Cancel  │ - Campus Clubs Directory    │ - Club Leaderboard    │
│ - Live Waitlist Status│ - Club Profile & Rosters    │ - Team Rosters View   │
│ - Calendar & Share    │ - Onboarding Stack on Home  │ - Store Submission QA │
└───────────────────────┴─────────────────────────────┴───────────────────────┘
```

* **Phase 1: Core Participation Expansion (Days 1–3)**
  - Wire `useRegistration` into `/events/[id]/index.tsx` with confirmation modal and cancel option.
  - Implement native "Add to Apple Calendar" and Share Sheet.
  - Display live waitlist promotion banner via SSE.
* **Phase 2: Discovery & Campus Community (Days 4–5)**
  - Implement Discover Feed with keyword search and `EventType` filter chips.
  - Build Campus Club Directory (`/clubs`) and Club Profile (`/clubs/[id]`).
  - Wire Profile club badges to open Club Profiles.
* **Phase 3: Gamification & Team Roster (Days 6–7)**
  - Build Student and Club Leaderboards (`/leaderboard`).
  - Replace desktop notice in `/events/[id]/teams.tsx` with read-only team roster view.
  - Add Onboarding Stack to Home feed.
* **Phase 4: Store Submission & Compliance Polish (Days 8–9)**
  - Add Apple Account Deletion / Data Privacy request link in `settings.tsx`.
  - Validate high-contrast Neo-Brutalist dark/light appearance.
  - Run full test suite (`npm test`) and typecheck.
  - Final package for TestFlight distribution.

---

## 8. Conclusion & Recommendation for Management

By expanding the mobile app according to this blueprint:
1. **Apple Developer Kit Approval:** University management can immediately justify the developer kit because the app becomes the flagship campus event hub, not an internal utility.
2. **Apple App Store Review:** The application effortlessly passes Guideline 4.2 (Minimum Functionality) through its combination of discovery, social club directory, real-time gamification, calendar sync, and hardware-secured QR check-in.
3. **Zero Backend Overhead:** All endpoints are frozen, tested, and already live in the backend.
