# UI Audit Report — NST Events Mobile (Prism v3.6.0)

**Date:** 2026-11-20  
**Target:** `apps/mobile` (Expo React Native, Android & iOS)  
**Governing Standard:** `apps/mobile/DESIGN.md` (Linear, Apple Wallet, Luma, Raycast aesthetic)

---

### Score: 6.2 / 10

| Category | Score | Notes |
|---|:---:|---|
| **Visual Hierarchy** | 6/10 | Functional but monotonous. Information density is flat; primary actions don't pop out over secondary elements. |
| **Typography** | 7/10 | Inter & JetBrains Mono are clean and compliant with 12px floor, but overuse of bracketed terminal syntax (`[ ... ]`) and raw uppercase makes it look like a retro developer CLI rather than a consumer campus app. |
| **Depth & Layering** | 5/10 | Overly flat. Every card is an identical dark rectangle (`#141C2E`) with a 1px border. Missing ambient lighting, specular highlights on borders, and depth cues. |
| **Interactive States** | 7/10 | Haptics and basic active opacities are present, but tactile spring physics, card scale feedback, and rich press states are minimal. |
| **Responsiveness & Spacing** | 8/10 | 48dp touch targets and padding scale adhere strictly to the 4px token system. |
| **Accessibility & Contrast** | 9/10 | Verified 100% WCAG 2.1 AA compliant across all 77 pairs; 12px ordinary text floor strictly enforced. |
| **Delight & Motion** | 4/10 | Stiff. When events or sessions are absent, empty states feel like dead ends rather than engaging campus discovery portals. Event cards lacking artwork look completely dark. |

---

### Why the UI Feels "Simple and Boring" Right Now

1. **Brutalist / Terminal Relics**:
   - The UI is still carrying over bracketed notation (`[ 📸 SCAN ATTENDANCE ]`, `[ 🔍 EXPLORE CAMPUS ]`, `[INBOX]`, `[STUDENT]`) from the old Neo-Brutalist v2 spec.
   - Linear and Apple Wallet use clean sentence-case titles, subtle badges, and bespoke iconography instead of ASCII/bracket wrappers.

2. **Absence of Visual Artwork & Generative Fallbacks**:
   - Local test events have `bannerUrl: null`. Instead of displaying an elegant geometric gradient mesh (as seen in Luma or Stripe), the card header collapses into a void.

3. **Flat Card Surfaces without Specular Sheen**:
   - Modern dark mode UIs (Linear, Raycast) use a **top-edge specular hairline** (`rgba(255,255,255,0.08)` on top, darker on bottom) to simulate physical light hitting the bevel.
   - All current containers are flat `#141C2E` with flat `#1E293B` outlines.

4. **Boring Hero Section**:
   - The top of the Home screen is a stark box: `STUDENT DASHBOARD` / `SOHAM DHANDE`.
   - It lacks an avatar ring, a contextual greeting ("Good evening, Soham"), academic affiliation pills ("B.Tech CSE '27"), or an active campus status dot.

5. **Ticket Passes Lack Physicality**:
   - In Apple Wallet, tickets feel like tangible cards with perforated tear-lines, high-contrast seat/session chips, and subtle corner notches.
   - Current tickets are standard rectangular cards that look identical to every other container.

---

### Top 3 Visual Transformations (Highest ROI)

#### 1. Linear-Grade Tactile Quick Actions (Home Screen)
Replace the flat bracketed text buttons (`[ 📸 SCAN ATTENDANCE ]`, etc.) with dual-column interactive action tiles featuring colored icon wells, micro-captions, and spring press feedback:

```tsx
// BEFORE:
<TouchableOpacity style={styles.scanBtn}>
  <MonoLabel>[ 📸 SCAN ATTENDANCE ]</MonoLabel>
</TouchableOpacity>

// AFTER:
<AnimatedTouchable style={styles.actionCardPrimary}>
  <View style={styles.iconWellPrimary}>
    <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
  </View>
  <View style={styles.actionTextCol}>
    <Text style={styles.actionTitle}>Scan Check-In</Text>
    <Text style={styles.actionSubtitle}>Verify presence at live session</Text>
  </View>
  <MaterialIcons name="arrow-forward" size={16} color="rgba(255,255,255,0.6)" />
</AnimatedTouchable>
```

#### 2. Procedural Geometric Mesh Gradients for Event Cards
When `bannerUrl` is null, render a rich mathematical gradient canvas using theme brand colors (`#1D4ED8` → `#4338CA` with subtle geometric dot overlay) so event cards feel premium and alive rather than empty.

#### 3. Apple Wallet-Inspired Ticket Architecture
Add subtle notched ticket geometry, a dashed perforation divider between event metadata and the Door QR section, and clean high-contrast pill chips (`Confirmed Pass`, `Gate 3`, `10:00 AM`).

