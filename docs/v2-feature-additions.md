# NST Events v2 — Feature Additions & Enhancements

> **Source Inspiration:** Analysis of Eventyay (FOSSASIA) open-source event management system adapted specifically for the university campus ecosystem (students, academic batches, clubs, and faculty).

---

## 1. Registration & Attendee Data

### 1.1 Custom Registration Questions (Form Builder)
* **What it adds:** Club organizers can define custom fields per event instead of being limited to fixed user attributes.
* **Supported Field Types:**
  * Short text & Long text (e.g., "GitHub Profile", "Project Pitch Summary")
  * Single-select dropdown & Multi-select checkboxes (e.g., "T-shirt Size: S/M/L/XL", "Dietary: Veg/Non-Veg/Jain")
  * File / Link inputs (e.g., "Resume Link", "Figma Design Link")
* **Rules & Constraints:** Required vs. Optional toggles, max length rules.
* **Admin Impact:** Automatic inclusion in attendee list exports (CSV/Excel) for meal planning, swag procurement, and team shortlisting.
* **Student Impact:** Interactive form steps during mobile and web registration.

### 1.2 Access Codes & Private Passcodes
* **What it adds:** Secret access codes (e.g., `VIP-GUEST-2026`, `CORE-TEAM-PASS`) for events.
* **Capabilities:**
  * Unlocks hidden/private registration slots.
  * Allows specific students (e.g., external invitees or cross-batch core team members) to register even if the event has batch restrictions (`SPECIFIC_BATCHES`).
  * Enables capacity bypass or reservation for VIP/judge seating.

### 1.3 Waitlist Auto-Promotion Pipeline
* **What it adds:** An automated promotion engine when registered participants or teams cancel.
* **Capabilities:**
  * When a registered attendee cancels, the system automatically promotes the next student on the waitlist.
  * Sends a high-priority push notification and gives the promoted student a configurable claim window (e.g., 6 hours) before rolling to the next person.

---

## 2. Event-Day Operations & Fast-Gate Check-in

### 2.1 Volunteer Fast-Gate Scanner (Kiosk Mode)
* **What it adds:** A high-speed, continuous camera scanner mode designed for club volunteers managing long entrance queues at auditoriums or campus gates.
* **Capabilities:**
  * Continuous 1-second camera loop without page reload.
  * Instant visual and haptic/audio feedback:
    * **GREEN + Audio Beep:** Valid registration, attendance marked.
    * **RED + Double Buzz:** Already checked in (prevents duplicate pass sharing).
    * **YELLOW:** Unregistered student or wrong batch.
  * Offline-resilient queue syncing when campus Wi-Fi fluctuates.

### 2.2 Swag, Kit & Meal Distribution Tracking
* **What it adds:** Multi-token redemption system for hackathons and multi-day fests.
* **Capabilities:**
  * Organizers configure redemption items: e.g., *"Event T-Shirt & Swag Bag"*, *"Day 1 Dinner"*, *"Day 2 Breakfast"*.
  * Scanning the student's admission pass marks the specific item as redeemed.
  * Prevents double-claiming without requiring physical paper meal coupons or manual tick sheets.

### 2.3 Multi-Zone / Sub-Station Check-in
* **What it adds:** Support for tracking attendance across multiple physical checkpoints within a single event.
* **Capabilities:**
  * Main Gate Check-in (entry to fest).
  * Workshop Room Check-in (entry to specific lab session).
  * Food Counter Check-in.
  * Independent session reports per zone.

---

## 3. Multi-Track Agenda & Live Campus Navigation

### 3.1 Multi-Track & Multi-Room Schedule Builder
* **What it adds:** Granular schedule management for full-day symposiums, hackathons, and cultural fests that run parallel activities.
* **Capabilities:**
  * **Tracks:** e.g., *Track A: AI & Machine Learning*, *Track B: Web3 & Systems*, *Track C: Design & UI/UX*.
  * **Venues / Rooms:** e.g., *Main Auditorium*, *Computer Lab 3*, *Seminar Hall B*.
  * Drag-and-drop or slot-based schedule editor in the admin dashboard.

### 3.2 Real-Time "Happening Now" Timeline (Mobile & Web)
* **What it adds:** Live dynamic schedule tab on the event screen for students.
* **Capabilities:**
  * Visual timeline highlighting the currently active session and room.
  * Countdown to upcoming sessions (e.g., *"Keynote ends in 15 mins → Next: Pitch Round at Hall 2"*).
  * Filter agenda by track or bookmarked sessions.

### 3.3 Speaker & Guest Mentor Profiles
* **What it adds:** Structured speaker and mentor profiles attached to event sessions.
* **Capabilities:**
  * Speaker photo, full name, organization/designation, LinkedIn URL, and bio.
  * Direct linkage between a speaker and their assigned agenda slot.

---

## 4. Campus Community & Engagement

### 4.1 Club Following & Instant Notifications
* **What it adds:** Student subscription/following system for campus clubs.
* **Capabilities:**
  * Students can tap `[FOLLOW]` on club profiles (e.g., ACM, GDG, Literary Club, Robotics Club).
  * Automatic push notifications when a followed club publishes a new event or opens registrations.
  * Club follower count and analytics visible to club admins.

### 4.2 Real-Time Audience Polls & Voting
* **What it adds:** In-app audience engagement during pitch competitions, hackathon demos, and cultural events.
* **Capabilities:**
  * Admin-triggered live polls (e.g., *"Vote for People's Choice Best Hack"*).
  * Single-vote enforcement tied to verified attendee IDs.
  * Real-time result graphs displayed on stage projector screens.

### 4.3 Organiser Broadcast Announcements
* **What it adds:** Live communication channel between club organizers and registered attendees.
* **Capabilities:**
  * Urgent broadcast updates (e.g., *"Venue shifted from Lab 1 to Audi 3"*, *"Dinner is now served in Cafeteria"*).
  * Multi-channel delivery: In-app notification alert, mobile push notification, and sticky warning banner on event details page.

### 4.4 Post-Event Feedback & Rating System
* **What it adds:** Automated feedback collection loop after events conclude.
* **Capabilities:**
  * Prompt sent to verified attendees (`ATTENDED`) 1 hour after event ends.
  * 1–5 star rating + optional qualitative feedback questions (e.g., *"Quality of content"*, *"Organization & logistics"*).
  * Aggregated NPS (Net Promoter Score) dashboard for club leads and faculty to measure event quality.

---

## 5. Academic Credentials & Digital Assets

### 5.1 Automated Verifiable Certificates of Participation
* **What it adds:** Automated certificate generation for attendees with confirmed attendance (`ATTENDED`).
* **Capabilities:**
  * Dynamic PDF generation with student name, academic roll number, event title, club branding, date, and faculty signature.
  * Unique cryptographic certificate ID with a public verification link (e.g., `events.nst.edu/verify/[certificateId]`).
  * Downloadable from student profile and shareable on LinkedIn.

### 5.2 Digital Wallet Passes (Apple & Google Wallet)
* **What it adds:** Exportable mobile wallet passes (`.pkpass` for Apple Wallet / Google Wallet pass).
* **Capabilities:**
  * One-tap addition from the mobile app after registration.
  * Lock-screen pass notifications triggered via geofencing as the student nears the campus auditorium.
  * Dynamic barcode updates reflecting check-in status.

### 5.3 Call for Participation (CfP) / Student Project Pitches
* **What it adds:** Proposal submission portal for student conferences, demo days, and open-mic tech talks.
* **Capabilities:**
  * Students submit talk title, abstract, slide deck, and co-speaker details.
  * Club core committee and faculty evaluation portal with scoring rubrics (e.g., Novelty, Technical Depth, Delivery).
  * One-click acceptance/rejection that automatically schedules approved talks into the event agenda.

---

## 6. Analytics, Governance & Auditing

### 6.1 Comprehensive Data Exporter
* **What it adds:** One-click data exports for campus administration.
* **Capabilities:**
  * Full attendee roster with registration timestamp, batch, roll number, check-in timestamp, and custom question answers.
  * Attendance percentage summaries per academic batch for faculty attendance credit.
  * Formats: CSV, Excel (`.xlsx`), and Printable PDF rosters.

### 6.2 Granular Activity & Audit Log
* **What it adds:** Complete traceability of organizer and administrative actions.
* **Capabilities:**
  * Chronological event log: Who submitted for approval, who approved, who modified capacity, who issued manual attendance overrides, and who locked the event.
  * Tamper-proof record for faculty compliance and dispute resolution.

---

## 7. Recommended Phased Implementation Matrix

| Phase | Feature Name | Primary Beneficiary | Complexity |
| :--- | :--- | :--- | :--- |
| **Phase 2.1** | Custom Registration Questions | Club Organizers / Hackathons | Low–Medium |
| **Phase 2.2** | Volunteer Fast-Gate Scanner (Kiosk Mode) | Queue Operations / Volunteers | Medium |
| **Phase 2.3** | Organiser Broadcast Announcements | Registered Students | Medium |
| **Phase 2.4** | Multi-Track Agenda & Happening Now Timeline | Attendees / Fest Organizers | Medium |
| **Phase 2.5** | Swag & Meal Distribution Tracking | Hackathon / Fest Logistics | Low–Medium |
| **Phase 2.6** | Verifiable Certificates of Participation | Students / Academic Portfolio | Medium |
| **Phase 2.7** | Post-Event Feedback & Rating System | Faculty / Club Leads | Low–Medium |
| **Phase 2.8** | Club Following & Subscriptions | Campus Community Growth | Low–Medium |
| **Phase 2.9** | Call for Participation (CfP) / Student Talks | Tech Symposiums / Demo Days | Medium–High |
| **Phase 2.10** | Live Audience Polls & Voting | Live Event Attendees | Medium |
