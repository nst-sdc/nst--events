# Student Web App: Current UX State

This document is a faithful snapshot of the current state of the `apps/dashboard/app/(student)` routes. It serves as a baseline for the redesign.

---

## 1. Auth & Entry (Login → Home)

```mermaid
graph TD
    A[Public Web] --> B(Login Page)
    B --> C{Has Google Token?}
    C -->|Yes| D[Exchange Token /auth/login]
    C -->|No| E[Google OAuth Flow]
    E --> D
    D --> F{Is Student?}
    F -->|Yes| G[Set Session Token]
    F -->|No| H[Deny Access: SEC-02]
    G --> I{Has return_to ?}
    I -->|Yes| J[Redirect to URL]
    I -->|No| K[Redirect to /student/home]
    
    L[Protected Route Load] --> M{Has valid token?}
    M -->|No| N[Redirect to Login]
    M -->|Yes| O[Hydrate User State]
```

* **Distinct UI States:**
  * **Loading (spinning):** Full-screen hydration spinner when checking session tokens.
  * **Error:** Distinct visual badges for error scenarios (`INSTITUTIONAL_DOMAIN_NOT_ALLOWED`, `STUDENT_ACCESS_NOT_AUTHORIZED`, `ACCESS_DENIED`, `AUTHENTICATION_FAILED`).
* **Conditional Branches:**
  * **Role Restriction:** The student layout requires the user to have a global `STUDENT` role (via API response).
  * **Return Path:** Preserves deep-links using a `return_to` query parameter.
* **NOT YET BUILT:** None. Core auth flow is fully functioning.

---

## 2. Home Dashboard Flow

```mermaid
graph TD
    A[Student Home] --> B{Data Loaded?}
    B -->|No| C[Show Skeleton Loaders]
    B -->|Yes| D[Dashboard Components]
    
    D --> E[Upcoming Events List]
    D --> F[Dashboard Stats/Summary]
    D --> G[My Registrations Card]
    
    E --> H[Click Event → Detail]
    G --> I[Click Registration → Tickets]
```

* **Distinct UI States:**
  * **Loading:** Independent skeleton loaders for User (`isUserLoading`), Registrations (`isRegLoading`), and Summary Data (`isSummaryLoading`).
  * **Error:** `<ErrorState>` component shown if aggregate fetching fails.
  * **Empty:** Shows "No upcoming events" graphic if registrations list is 0.
* **Conditional Branches:**
  * Aggregates multiple API responses; overall UI relies on all 3 resolving to remove the global loading block.
* **NOT YET BUILT:** None.

---

## 3. Campus: Discover Feed

```mermaid
graph TD
    A[Campus: Discover] --> B[Filter/Search Bar]
    B --> C{Load Events}
    C -->|Empty| D[Empty State View]
    C -->|Populated| E[Event List Feed]
    E --> F[Scroll]
    F --> G{Has More?}
    G -->|Yes| H[Load More Spinner]
    E --> I[Click Event Card]
    I --> J[Event Detail Page]
```

* **Distinct UI States:**
  * **Loading:** Skeletons while the feed paginates or mounts.
  * **Empty:** Text when `data.length === 0`.
  * **Error:** `<ErrorState>` on fetch failure.
* **Conditional Branches:**
  * **Type Filter:** Branches API call if a `typeVal` (e.g., Hackathon, Workshop) is selected.
* **NOT YET BUILT:** 
  * Search input placeholders state "Search events, clubs, topics..." but lack complex fuzzy searching.

---

## 4. Campus: Clubs List & Detail

```mermaid
graph TD
    A[Campus: Clubs] --> B[Search Clubs]
    B --> C[Clubs Directory]
    C --> D[Click Club Card]
    D --> E[Club Detail Page]
    
    E --> F{Is User a Club Admin?}
    F -->|Yes| G[Show 'Manage Club' Actions]
    F -->|No| H[Standard View]
    
    E --> I[Club Events Feed]
```

* **Distinct UI States:**
  * **Loading:** `isClubLoading` / `isEventsLoading` handled independently.
  * **Empty:** Empty state when a club has no upcoming/past events.
  * **Error:** Club not found error.
* **Conditional Branches:**
  * **Follower formatting:** Branches to shorthand formatting `(num >= 1000)` for large follower counts.
  * **Club Admin Override:** If the current student has `CLUB_ADMIN` rights for *this specific club*, management entry points become visible.
* **NOT YET BUILT:**
  * Search inputs are functionally basic.

---

## 5. Campus: Leaderboard

```mermaid
graph TD
    A[Leaderboard] --> B[Tabs]
    B --> C[Students Tab]
    B --> D[Clubs Tab]
    
    C --> E[Student Rankings List]
    D --> F[Club Rankings List]
```

* **Distinct UI States:**
  * **Loading:** Independent loading states (`isStudentsLoading`, `isClubsLoading`).
  * **Empty:** Renders empty state if no points data exists for the selected timeframe.
* **Conditional Branches:**
  * Data fetched is entirely contingent on the active Tab.
* **NOT YET BUILT:** None.

---

## 6. Event Detail & Registration

```mermaid
graph TD
    A[Event Detail] --> B{Is Club Admin?}
    B -->|Yes| C[Show Organizer 'Manage Event' Button]
    B -->|No| D[Check Registration Status]
    
    D --> E{Event State}
    E -->|Locked/Ended| F[Disabled / Ended UI]
    E -->|Active| G{Registration Type}
    
    G -->|Solo| H[Solo Flow]
    G -->|Team| I[Team Flow]
    
    H --> J{Status?}
    J -->|Not Registered| K[Register Button]
    J -->|Waitlisted| L[Waitlist Status]
    J -->|Registered| M[View Ticket / Cancel]
    
    I --> N{Status?}
    N -->|Not in Team| O[Create/Join Team]
    N -->|In Team| P[View Team Hub]
```

* **Distinct UI States:**
  * **Loading:** Multiple discrete loaders (`isLoadingEvent`, `isLoadingReg`, `isLoadingTeam`, `isLoadingDisputes`, `isLoadingAttendance`).
  * **Error:** Fails gracefully with a return button.
* **Conditional Branches:**
  * **Organizer Mode:** Injects top-level admin buttons if user holds `CLUB_ADMIN` context.
  * **Lifecycle Lock:** Event `isEnded` or `isLocked` entirely hides registration CTAs.
  * **Status Toggles:** The CTA entirely changes depending on `registration.status` (Waitlisted vs Confirmed).
  * **Type Toggle:** `TEAM` events hide solo registration logic and mandate Team Hub transitions.
* **NOT YET BUILT:** None. Highly dynamic branch logic.

---

## 7. Team Hub

```mermaid
graph TD
    A[Team Hub] --> B{Is Event Team-Based?}
    B -->|No| C[Error / Redirect]
    B -->|Yes| D[Team Management Dashboard]
    
    D --> E{Is Team Leader?}
    E -->|Yes| F[Invite Members]
    E -->|Yes| G[Transfer Leadership]
    E -->|Yes| H[Disband/Leave Team]
    E -->|No| I[Leave Team]
```

* **Distinct UI States:**
  * **Loading:** Event, Reg, and Team data must resolve.
  * **Empty:** Shows member slots when below maximum size.
* **Conditional Branches:**
  * **Type Guard:** Instantly branches/errors if `event.registrationType !== 'TEAM'`.
  * **Leadership:** Delete/Transfer buttons are strictly gated by checking if the user's ID matches the team's `leader_id`.
* **NOT YET BUILT:** None.

---

## 8. Organizer/Manage Flows

```mermaid
graph TD
    A[Manage Club] --> B[Edit Profile]
    A --> C[Manage Roster]
    
    D[Manage Events] --> E[Event List]
    E --> F[Create Event]
    F --> G{Action}
    G -->|Save Draft| H[Status: DRAFT]
    G -->|Submit| I[Status: PENDING_APPROVAL]
    
    E --> J[Click Live Event]
    J --> K[Event Management Dashboard]
    
    K --> L[Edit Event Details]
    L --> M{Is Event Locked?}
    M -->|Yes| N[Request Approval to Edit]
    M -->|No| O[Save Edits]
    
    K --> P[Manage Attendance]
    P --> Q[Generate QR / Start Session]
    P --> R[Resolve Disputes]
    
    K --> S[Manage Registrations / Teams]
```

* **Distinct UI States:**
  * **Loading:** Heavily relies on suspense and query loading states across all dashboards.
  * **Empty:** Standard empty states for 0 teams, 0 registrations, or 0 disputes.
* **Conditional Branches:**
  * **Creation Lifecycle:** Form submission branches between `DRAFT` and `SUBMIT`.
  * **Edit Locks:** `event.state !== 'DRAFT'` enforces restrictive edit modes.
  * **Attendance Permissions:** UI branches based on `auth.canManageAttendance`.
  * **Active Session:** QR code and scanners only mount if `isSessionActive` is true.
* **NOT YET BUILT:**
  * Heavy reliance on placeholder text (e.g., "e.g. Auditorium 1", "Tell everyone what this club is about...", "Search registered student by name").
  * Dispute resolution requires a reason but relies on simple text inputs.

---

## 9. Notifications Flow

```mermaid
graph TD
    A[Notifications Tab] --> B{Has Notifications?}
    B -->|No| C[Empty Inbox Graphic]
    B -->|Yes| D[Notifications List]
    
    D --> E[Click Notification]
    E --> F{Has Target URL?}
    F -->|Yes| G[Mark Read & Navigate]
    F -->|No| H[Mark Read & Expand in Place]
```

* **Distinct UI States:**
  * **Loading:** Standard spinner.
  * **Empty:** Clean empty graphic when `data?.pages[0]?.data.length === 0`.
  * **Error:** Retry state on fetch failure.
* **Conditional Branches:**
  * **Read Status:** Visually distinguishes unread (`!notif.readAt`) versus read.
  * **Navigation:** `targetHref` existence determines if a click is a link or just an accordion/status update.
* **NOT YET BUILT:** None.

---

## 10. Profile

```mermaid
graph TD
    A[Profile Tab] --> B[User Meta Data]
    A --> C[Notification Preferences]
    A --> D[Theme Settings]
    A --> E[Club Memberships List]
    A --> F[Logout]
```

* **Distinct UI States:**
  * **Loading:** Separates `isLoadingUser` from `isLoadingPrefs`.
  * **Error:** Explanatory text if user payload drops.
* **Conditional Branches:**
  * **Program/Batch Formatting:** UI branches to hide dividers if `batchText` or `programText` are missing from the student record.
* **NOT YET BUILT:** None.
