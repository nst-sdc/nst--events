# NST-Events — Student Frontend Design System Reference

**Purpose:** This is the authoritative standing UI reference for all student-facing frontend surfaces (mobile companion app and student web views). Any AI coding tool generating or editing student-facing UI in this codebase MUST adhere to this design system. It codifies the active, in-code design language: **Neo-Brutalist Kinetic Noir / Stark Light**.

---

## 1. Design Philosophy & Aesthetic Foundation

- **Design Style: Neo-Brutalist Technical Companion.**
  - High-contrast, sharp-edged, data-dense, and highly legible.
  - Geometry is strictly regular with **sharp corners** (`borderRadius: 0` or minimal `2px`/`4px` strictly bounded).
  - No soft drop shadows or blurred Gaussian elevation. Surfaces and elevation are communicated exclusively through contrasting container tonal layers and crisp 1px borders.
  - Technical, audit-grade visual hierarchy: status pills formatted with bracketed notation (e.g. `[PRESENT]`, `[LIVE NOW]`), monospace metadata fields, and tabular grid rows.
- **Platforms:**
  - **Expo React Native Mobile App (`apps/mobile`):** Android-first reference standard with identical 1:1 parity on iOS.
  - **Next.js Web Dashboard (`apps/dashboard`):** Desktop-first student surfaces reflecting identical visual tokens and layout discipline.
- **Strict Anti-Optimistic Stance:** Never fake success or render checkmarks before the backend confirms. Consequential state mutations always show an honest pending/loading state.

---

## 2. Color & Tonal Surface System

The color system is organized into tonal container layers and semantic status roles, fully implemented in `apps/mobile/src/ui/theme.ts`:

### 2.1 Dark Palette (Kinetic Noir — Default)
| Role / Token | Hex Value | Usage |
|---|---|---|
| `surface` | `#131313` | Root background |
| `surfaceSubdued` | `#1A1A1A` | Secondary background sections |
| `surfaceContainerLowest`| `#0e0e0e` | Bottom tab bar, deep background |
| `surfaceContainerLow` | `#1b1b1b` | Cards, list item containers |
| `surfaceContainer` | `#1f1f1f` | Neutral containers, dividers |
| `surfaceContainerHigh` | `#2a2a2a` | Highlighted cards, chips, active tabs |
| `surfaceContainerHighest`| `#353535` | Inactive switch tracks, elevated chips |
| `primary` | `#b7c4ff` | Primary CTA, focused borders, active icons |
| `primaryFixed` | `#dde1ff` | High-visibility primary badges |
| `onPrimary` | `#002682` | Text on filled primary buttons |
| `secondary` | `#7bd0ff` | Organizer badges, secondary highlights |
| `onSecondary` | `#00354a` | Text on filled secondary buttons |
| `error` | `#ffb4ab` | Error borders, live status tags, alert pills |
| `errorContainer` | `#93000a` | Access denied banners, critical notices |
| `onErrorContainer` | `#ffdad6` | Text within error containers |
| `onSurface` | `#e2e2e2` | Primary typography |
| `onSurfaceVariant` | `#c3c5d9` | Subtitles, labels, metadata |
| `outline` | `#8d90a2` | Muted labels, secondary indicators |
| `outlineVariant` / `borderHairline` | `#434656` | 1px card borders, section separators |

### 2.2 Light Palette (Stark Light)
| Role / Token | Hex Value | Usage |
|---|---|---|
| `surface` | `#fbfbfb` | Root background |
| `surfaceContainerLowest`| `#ffffff` | Elevated pure white containers |
| `surfaceContainerLow` | `#f7f7f7` | Card backgrounds |
| `surfaceContainerHigh` | `#e8e8e8` | Active tab background |
| `primary` | `#0046d1` | Primary actions, high-contrast borders |
| `onPrimary` | `#ffffff` | Text on primary buttons |
| `secondary` | `#006a8f` | Accent and organizer tags |
| `error` | `#ba1a1a` | Live badges, attendance failures |
| `onSurface` | `#131313` | Primary body typography |
| `onSurfaceVariant` | `#434656` | Muted text, secondary captions |
| `outlineVariant` / `borderHairline` | `#d1d3df` | 1px card borders, section dividers |

### 2.3 Status Color Mapping
| Status | Token Role | Format / Visual Pattern |
|---|---|---|
| **Registered / Present / Verified** | `primary` / `primaryFixed` | `[PRESENT]`, `[REGISTERED]` badge with solid hairline border |
| **Live / Active Session** | `error` | `[LIVE NOW]` badge with red ping dot indicator |
| **Waitlisted / Pending / Below Min** | Warning / Yellow / `secondary` | `[WAITLISTED]`, `[PENDING]` caution status badge |
| **Cancelled / Rejected / Absent** | `error` / `errorContainer` | `[ABSENT]`, `[REJECTED]` badge |
| **Neutral / Idempotent (Already Checked In)**| `onSurfaceVariant` | `[ATTENDANCE MARKED]` neutral status box, never styled as error |

---

## 3. Typography Hierarchy

The typography system pairs geometric display headers with readable body sans-serif and rigorous monospace labels:

| Category | Font Family | Token Name | Purpose |
|---|---|---|---|
| **Display / Hero** | `Syne` (Bold / ExtraBold) | `syneBold`, `syneExtraBold` | Screen titles, hero headlines, event names |
| **Body Sans** | `Inter` (Regular, Medium, SemiBold) | `interRegular`, `interMedium`, `interSemiBold` | Event descriptions, body text, dialogue copy |
| **Technical Mono** | `JetBrains Mono` (Regular, Med, Bold) | `monoRegular`, `monoMedium`, `monoBold` | Metadata labels, timestamps, status badges, code pills |

### Rules:
- Display headings should use uppercase or tight tracking for emphasis.
- Metadata and system statuses MUST use `JetBrains Mono` with uppercase notation (e.g. `LOCATION // MAIN AUDITORIUM`, `STATUS: NOT REGISTERED`).
- Never introduce generic browser fallback fonts or soft rounded display fonts.

---

## 4. Component Standards & Usage Rules

Use the verified Neo-Brutalist components in `apps/mobile/src/ui/`:

### 4.1 Shell & Structure (`MobileShell`)
- Standardized screen container providing:
  - Top header with mono system label (`NST EVENTS // ATTENDANCE`).
  - Active connection ping dot and notification counter access.
  - Optional back button (`showBackButton`).
  - Scrollable view with native `RefreshControl` integration.

### 4.2 Buttons (`Button`)
- Sharp rectangular corners (`borderRadius: 0` or `borderRadius.sm: 2`).
- Bold uppercase typography (`monoBold` or `interSemiBold`).
- High-contrast states:
  - `primary`: Filled primary with `onPrimary` text.
  - `secondary`: Hairline outlined box with subtle container background.
  - `danger`: Error container border with error action text.
  - `disabled`: Muted opacity (`0.4`), non-interactive.

### 4.3 Status Badges (`StatusBadge`)
- Compact monospace pill wrapped in square brackets: `[STATUS]`.
- Enclosed in a 1px border matching the status color.

### 4.4 Cards & Data Rows (`Cards`)
- **EventCard:** High-contrast bordered card with status pill, event title, date/time, venue, and chevron action indicator.
- **ActiveAttendanceCard:** Dominant elevated card with `[LIVE NOW]` tag and direct action button `[SCAN QR / MARK ATTENDANCE]`.
- **MatrixCard / LedgerBox:** Tabular key-value rows separated by 1px hairline dividers for technical auditability.

### 4.5 QR Scanner Viewport (`ScannerOverlay`)
- Clean hardware camera overlay with four crisp corner framing brackets.
- Live scan line and torch control toggle button.
- Monospace telemetry overlay indicating geofence verification status.

### 4.6 Dialogs & Friction Moments
- Add deliberate modal confirmation dialogs for consequential actions:
  - Event registration & cancellation.
  - Accepting / declining team invitations.
  - Terminating user session (Logout).
  - Filing attendance disputes.
- Never execute consequential state changes from a single unconfirmed tap.

---

## 5. Spacing, Borders & Touch Targets

- **Base Spacing Grid:** 4px / 8px / 12px / 16px (`base`) / 20px / 24px (`xl`).
- **Border Standards:**
  - Standard container border: `1px solid borderHairline` (`#434656` dark / `#d1d3df` light).
  - Focused/active container border: `1.5px` or `2px solid primary`.
  - Corner radius: `0px` sharp edges across all cards, buttons, and badges.
- **Touch Targets:** Minimum **48dp** height/width for all interactive buttons and actionable card surfaces.

---

## 6. Tone & Error Handling Guidelines

1. **Security-Sensitive Parity:**
   - Geofence verification failures and location spoofing detections MUST display the identical neutral copy:
     `"We couldn't verify your location for this event."`
   - Never reveal detection heuristics to end-users.
2. **Actionable Recovery:**
   - Expired QR code → immediate viewfinder reset, re-prompt camera.
   - Network drop → explicit `NETWORK_OFFLINE` guidance: `"Active network connection required to verify attendance."`
3. **Idempotent States:**
   - Re-scanning an already checked-in session renders neutral status: `"Already checked in at [time]"`, never an error tone.

---

## 7. Explicit Prohibitions

- **NO Material Design 3 (M3) components, rounded pill shapes, or M3 elevation levels.**
- **NO drop shadows, blurry glows, or gradient fills.**
- **NO soft pastel palettes or un-tokenized ad hoc colors.**
- **NO optimistic UI updates for QR scans, registrations, or dispute submissions.**
- **NO avatar photo upload UI — student avatars are generated from initials or Google SSO.**
