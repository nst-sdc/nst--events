-- Migration: 20261101000000_add_system_policies
-- Purpose:
-- 1. Create system_policies table to persist institutional legal policies (Privacy Policy, Terms).
-- 2. Add foreign key relation on users (published_by_id references users.id ON DELETE SET NULL).
-- 3. Enable and enforce Row Level Security on system_policies with policies for SELECT, INSERT, UPDATE, DELETE.
-- 4. Grant table privileges to nst_app and nst_worker.
-- 5. Seed baseline Privacy Policy extracted from the initial hardcoded public page.
-- 6. Insert initial audit_logs entry for the baseline seed (actor_id NULL, entity_id NULL).

-- =========================================================================
-- 1. Create system_policies Table
-- =========================================================================

CREATE TABLE IF NOT EXISTS "system_policies" (
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "published_content" TEXT NOT NULL,
    "draft_content" TEXT NOT NULL,
    "concurrency_revision" INTEGER NOT NULL DEFAULT 1,
    "published_version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ(6),
    "published_by_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_policies_pkey" PRIMARY KEY ("slug"),
    CONSTRAINT "system_policies_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "system_policies_published_at_idx" ON "system_policies"("published_at");

-- =========================================================================
-- 2. Enable & Enforce Row Level Security
-- =========================================================================

ALTER TABLE "system_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_policies" FORCE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "system_policies" TO nst_app;
GRANT SELECT ON TABLE "system_policies" TO nst_worker;

-- RLS Policies
DROP POLICY IF EXISTS "Allow SELECT on system_policies" ON "system_policies";
CREATE POLICY "Allow SELECT on system_policies" ON "system_policies"
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow INSERT on system_policies" ON "system_policies";
CREATE POLICY "Allow INSERT on system_policies" ON "system_policies"
FOR INSERT TO nst_app
WITH CHECK (
  current_user_id() IS NULL
  OR EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow UPDATE on system_policies" ON "system_policies";
CREATE POLICY "Allow UPDATE on system_policies" ON "system_policies"
FOR UPDATE TO nst_app
USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

DROP POLICY IF EXISTS "Allow DELETE on system_policies" ON "system_policies";
CREATE POLICY "Allow DELETE on system_policies" ON "system_policies"
FOR DELETE TO nst_app
USING (
  current_user_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = current_user_id() AND u.global_role = 'PLATFORM_ADMIN'
  )
);

-- =========================================================================
-- 3. Seed Initial Baseline Policy
-- =========================================================================

INSERT INTO "system_policies" (
    "slug",
    "title",
    "published_content",
    "draft_content",
    "concurrency_revision",
    "published_version",
    "published_at",
    "published_by_id",
    "updated_at"
) VALUES (
    'privacy-policy',
    'Privacy Policy — NST Events',
    $CONTENT$# Privacy Policy — NST Events

**Effective date:** September 9, 2026  
**Last updated:** September 9, 2026

NST Student Developer Club (nst-sdc) ("we," "us," "our") operates the NST Events mobile and web applications (the "Service"), used by students and faculty of Newton School of Technology (NST), Pune to manage event registration and attendance.

This policy explains what information we collect, why we collect it, and how it is stored and used. By using the Service, you agree to the practices described here.

## 1. Who Can Use This Service

Access is restricted to individuals with an authorized institutional email address (currently `@adypu.edu.in` and `@newtonschool.co`). Sign-in is performed exclusively through Google Sign-In; we do not support or store separate passwords.

## 2. Information We Collect

### 2.1 Account Information

When you sign in with Google, we receive and store:

- Your email address
- Your full name
- A unique Google account identifier
- Your profile picture URL, if available

We use this to create and identify your account and to verify you belong to an authorized institution.

### 2.2 Location Data

To mark attendance at an event, the app collects your device's **precise GPS location** at the moment you scan an event's attendance QR code. This is used solely to confirm you are physically present at the event venue (a "geofence" check). Location is requested only when you actively use the attendance-scanning feature — the app does not track your location in the background or at any other time.

Along with your coordinates, we also record the reported GPS accuracy of that reading and whether your device flagged the location as a simulated/mock location, both used to detect fraudulent attendance attempts.

### 2.3 Device Information

We collect a device identifier and device operating system (Android/iOS) at the time of attendance marking, and separately for push notification delivery. This helps us detect duplicate or fraudulent check-ins and deliver notifications to the correct device.

### 2.4 Camera

The app requests camera access solely to scan QR codes for attendance. We do not store photos, video, or any camera data — the camera is used only to read the QR code displayed at an event.

### 2.5 Usage and Account Activity

We log certain actions for security and auditing purposes, including:

- IP address and browser/device user-agent string, recorded at sign-in and stored with your session, to detect unauthorized access or token theft
- A record of administrative actions taken on the platform (e.g. attendance corrections, role changes)

### 2.6 Push Notifications

If you enable notifications, your device is issued a push token (via Expo's push notification service) so we can deliver event reminders and updates. Notification content (such as event or club names) is transmitted through Expo's infrastructure to Apple and Google's push services to reach your device.

## 3. How We Use Your Information

We use the information above to:

- Authenticate you and confirm your eligibility to use the Service
- Record and verify event attendance
- Detect and prevent fraudulent attendance (e.g. GPS spoofing, duplicate check-ins)
- Operate leaderboard, team, and event registration features
- Send you event-related notifications
- Investigate disputes or misuse of the platform
- Maintain the security of accounts and sessions

We do not sell your information, and we do not use your data for advertising.

## 4. Who We Share Information With

- **Google**: used solely for authentication (Google Sign-In). Google's own privacy policy governs the data it processes as part of that sign-in.
- **Expo (push notification infrastructure)**: device push tokens and notification content pass through Expo's servers to reach Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM).
- **Newton School of Technology (NST), Pune staff/faculty administrators**: authorized administrators and club officers can view attendance and registration data for events they organize, as necessary to run those events.

We do not share your data with any other third party, and we do not use third-party analytics or advertising SDKs.

## 5. Data Retention

Attendance records, event participation history, and related audit logs are retained **permanently as part of your institutional academic record**, in the same way attendance registers, transcripts, or grade records are retained by Newton School of Technology (NST), Pune. This data is not deleted when you graduate, leave the institution, or stop using the app, as it may be needed for academic integrity, dispute resolution, or institutional record-keeping purposes.

We do not offer deletion of attendance or academic-activity records. You may request that your **account access be deactivated** (see Section 6), which prevents future sign-in and use of the Service, but does not erase your historical attendance or participation records.

## 6. Your Choices

- **Location**: you may decline location permission, but you will not be able to mark attendance via QR scan, as this is required to verify physical presence.
- **Camera**: required only for QR scanning; you may decline, but attendance scanning will not function.
- **Notifications**: optional; you may disable these at any time in your device settings.
- **Sign out**: you may sign out of the app at any time, which ends your active session on that device.
- **Account deactivation**: contact us using the details in Section 9 to request that your account be deactivated. This disables future access but does not delete your historical academic/attendance records, as explained in Section 5.

## 7. Children's Privacy

Our Service is intended exclusively for enrolled university students, faculty, and authorized staff of Newton School of Technology (NST), Pune and Ajeenkya DY Patil University (typically ages 17 and above). We do not knowingly collect or solicit personal information from children under the age of 13. If you believe that a child under 13 has provided us with personal information, please contact us immediately at [support@nstsdc.com](mailto:support@nstsdc.com) so that we can take appropriate measures.

## 8. Data Security

We use industry-standard measures to protect your data, including encrypted network connections (HTTPS) and access controls limiting who can view administrative or personal data. No system is perfectly secure, and we cannot guarantee absolute security.

## 9. Contact Us

If you have questions about this policy or wish to exercise your data rights, contact:

**NST Student Developer Club (nst-sdc)**  
Email: [support@nstsdc.com](mailto:support@nstsdc.com)  
Newton School of Technology (NST), Pune

## 10. Changes to This Policy

We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the updated policy.

---

This policy applies to both the NST Events mobile application (Android and iOS) and the NST Events web dashboard.$CONTENT$,
    $CONTENT$# Privacy Policy — NST Events

**Effective date:** September 9, 2026  
**Last updated:** September 9, 2026

NST Student Developer Club (nst-sdc) ("we," "us," "our") operates the NST Events mobile and web applications (the "Service"), used by students and faculty of Newton School of Technology (NST), Pune to manage event registration and attendance.

This policy explains what information we collect, why we collect it, and how it is stored and used. By using the Service, you agree to the practices described here.

## 1. Who Can Use This Service

Access is restricted to individuals with an authorized institutional email address (currently `@adypu.edu.in` and `@newtonschool.co`). Sign-in is performed exclusively through Google Sign-In; we do not support or store separate passwords.

## 2. Information We Collect

### 2.1 Account Information

When you sign in with Google, we receive and store:

- Your email address
- Your full name
- A unique Google account identifier
- Your profile picture URL, if available

We use this to create and identify your account and to verify you belong to an authorized institution.

### 2.2 Location Data

To mark attendance at an event, the app collects your device's **precise GPS location** at the moment you scan an event's attendance QR code. This is used solely to confirm you are physically present at the event venue (a "geofence" check). Location is requested only when you actively use the attendance-scanning feature — the app does not track your location in the background or at any other time.

Along with your coordinates, we also record the reported GPS accuracy of that reading and whether your device flagged the location as a simulated/mock location, both used to detect fraudulent attendance attempts.

### 2.3 Device Information

We collect a device identifier and device operating system (Android/iOS) at the time of attendance marking, and separately for push notification delivery. This helps us detect duplicate or fraudulent check-ins and deliver notifications to the correct device.

### 2.4 Camera

The app requests camera access solely to scan QR codes for attendance. We do not store photos, video, or any camera data — the camera is used only to read the QR code displayed at an event.

### 2.5 Usage and Account Activity

We log certain actions for security and auditing purposes, including:

- IP address and browser/device user-agent string, recorded at sign-in and stored with your session, to detect unauthorized access or token theft
- A record of administrative actions taken on the platform (e.g. attendance corrections, role changes)

### 2.6 Push Notifications

If you enable notifications, your device is issued a push token (via Expo's push notification service) so we can deliver event reminders and updates. Notification content (such as event or club names) is transmitted through Expo's infrastructure to Apple and Google's push services to reach your device.

## 3. How We Use Your Information

We use the information above to:

- Authenticate you and confirm your eligibility to use the Service
- Record and verify event attendance
- Detect and prevent fraudulent attendance (e.g. GPS spoofing, duplicate check-ins)
- Operate leaderboard, team, and event registration features
- Send you event-related notifications
- Investigate disputes or misuse of the platform
- Maintain the security of accounts and sessions

We do not sell your information, and we do not use your data for advertising.

## 4. Who We Share Information With

- **Google**: used solely for authentication (Google Sign-In). Google's own privacy policy governs the data it processes as part of that sign-in.
- **Expo (push notification infrastructure)**: device push tokens and notification content pass through Expo's servers to reach Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM).
- **Newton School of Technology (NST), Pune staff/faculty administrators**: authorized administrators and club officers can view attendance and registration data for events they organize, as necessary to run those events.

We do not share your data with any other third party, and we do not use third-party analytics or advertising SDKs.

## 5. Data Retention

Attendance records, event participation history, and related audit logs are retained **permanently as part of your institutional academic record**, in the same way attendance registers, transcripts, or grade records are retained by Newton School of Technology (NST), Pune. This data is not deleted when you graduate, leave the institution, or stop using the app, as it may be needed for academic integrity, dispute resolution, or institutional record-keeping purposes.

We do not offer deletion of attendance or academic-activity records. You may request that your **account access be deactivated** (see Section 6), which prevents future sign-in and use of the Service, but does not erase your historical attendance or participation records.

## 6. Your Choices

- **Location**: you may decline location permission, but you will not be able to mark attendance via QR scan, as this is required to verify physical presence.
- **Camera**: required only for QR scanning; you may decline, but attendance scanning will not function.
- **Notifications**: optional; you may disable these at any time in your device settings.
- **Sign out**: you may sign out of the app at any time, which ends your active session on that device.
- **Account deactivation**: contact us using the details in Section 9 to request that your account be deactivated. This disables future access but does not delete your historical academic/attendance records, as explained in Section 5.

## 7. Children's Privacy

Our Service is intended exclusively for enrolled university students, faculty, and authorized staff of Newton School of Technology (NST), Pune and Ajeenkya DY Patil University (typically ages 17 and above). We do not knowingly collect or solicit personal information from children under the age of 13. If you believe that a child under 13 has provided us with personal information, please contact us immediately at [support@nstsdc.com](mailto:support@nstsdc.com) so that we can take appropriate measures.

## 8. Data Security

We use industry-standard measures to protect your data, including encrypted network connections (HTTPS) and access controls limiting who can view administrative or personal data. No system is perfectly secure, and we cannot guarantee absolute security.

## 9. Contact Us

If you have questions about this policy or wish to exercise your data rights, contact:

**NST Student Developer Club (nst-sdc)**  
Email: [support@nstsdc.com](mailto:support@nstsdc.com)  
Newton School of Technology (NST), Pune

## 10. Changes to This Policy

We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the updated policy.

---

This policy applies to both the NST Events mobile application (Android and iOS) and the NST Events web dashboard.$CONTENT$,
    1,
    1,
    '2026-09-09 00:00:00+00',
    NULL,
    CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING;

-- =========================================================================
-- 4. Seed Initial Audit Record
-- =========================================================================

INSERT INTO "audit_logs" (
    "actor_id",
    "action",
    "entity_type",
    "entity_id",
    "previous_state",
    "new_state",
    "created_at"
) VALUES (
    NULL,
    'POLICY_INITIAL_SEED',
    'SystemPolicy',
    NULL,
    NULL,
    jsonb_build_object(
        'slug', 'privacy-policy',
        'title', 'Privacy Policy — NST Events',
        'published_version', 1,
        'concurrency_revision', 1,
        'published_at', '2026-09-09T00:00:00.000Z',
        'publisher_name', 'System Initial Seed',
        'publisher_email', 'system@nstsdc.org',
        'content_sha256', '057eb6a3f267e52d191ae2637b70a254743352e28a3ee8e1abb63c13f3dcbd16',
        'content', $CONTENT$# Privacy Policy — NST Events

**Effective date:** September 9, 2026  
**Last updated:** September 9, 2026

NST Student Developer Club (nst-sdc) ("we," "us," "our") operates the NST Events mobile and web applications (the "Service"), used by students and faculty of Newton School of Technology (NST), Pune to manage event registration and attendance.

This policy explains what information we collect, why we collect it, and how it is stored and used. By using the Service, you agree to the practices described here.

## 1. Who Can Use This Service

Access is restricted to individuals with an authorized institutional email address (currently `@adypu.edu.in` and `@newtonschool.co`). Sign-in is performed exclusively through Google Sign-In; we do not support or store separate passwords.

## 2. Information We Collect

### 2.1 Account Information

When you sign in with Google, we receive and store:

- Your email address
- Your full name
- A unique Google account identifier
- Your profile picture URL, if available

We use this to create and identify your account and to verify you belong to an authorized institution.

### 2.2 Location Data

To mark attendance at an event, the app collects your device's **precise GPS location** at the moment you scan an event's attendance QR code. This is used solely to confirm you are physically present at the event venue (a "geofence" check). Location is requested only when you actively use the attendance-scanning feature — the app does not track your location in the background or at any other time.

Along with your coordinates, we also record the reported GPS accuracy of that reading and whether your device flagged the location as a simulated/mock location, both used to detect fraudulent attendance attempts.

### 2.3 Device Information

We collect a device identifier and device operating system (Android/iOS) at the time of attendance marking, and separately for push notification delivery. This helps us detect duplicate or fraudulent check-ins and deliver notifications to the correct device.

### 2.4 Camera

The app requests camera access solely to scan QR codes for attendance. We do not store photos, video, or any camera data — the camera is used only to read the QR code displayed at an event.

### 2.5 Usage and Account Activity

We log certain actions for security and auditing purposes, including:

- IP address and browser/device user-agent string, recorded at sign-in and stored with your session, to detect unauthorized access or token theft
- A record of administrative actions taken on the platform (e.g. attendance corrections, role changes)

### 2.6 Push Notifications

If you enable notifications, your device is issued a push token (via Expo's push notification service) so we can deliver event reminders and updates. Notification content (such as event or club names) is transmitted through Expo's infrastructure to Apple and Google's push services to reach your device.

## 3. How We Use Your Information

We use the information above to:

- Authenticate you and confirm your eligibility to use the Service
- Record and verify event attendance
- Detect and prevent fraudulent attendance (e.g. GPS spoofing, duplicate check-ins)
- Operate leaderboard, team, and event registration features
- Send you event-related notifications
- Investigate disputes or misuse of the platform
- Maintain the security of accounts and sessions

We do not sell your information, and we do not use your data for advertising.

## 4. Who We Share Information With

- **Google**: used solely for authentication (Google Sign-In). Google's own privacy policy governs the data it processes as part of that sign-in.
- **Expo (push notification infrastructure)**: device push tokens and notification content pass through Expo's servers to reach Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM).
- **Newton School of Technology (NST), Pune staff/faculty administrators**: authorized administrators and club officers can view attendance and registration data for events they organize, as necessary to run those events.

We do not share your data with any other third party, and we do not use third-party analytics or advertising SDKs.

## 5. Data Retention

Attendance records, event participation history, and related audit logs are retained **permanently as part of your institutional academic record**, in the same way attendance registers, transcripts, or grade records are retained by Newton School of Technology (NST), Pune. This data is not deleted when you graduate, leave the institution, or stop using the app, as it may be needed for academic integrity, dispute resolution, or institutional record-keeping purposes.

We do not offer deletion of attendance or academic-activity records. You may request that your **account access be deactivated** (see Section 6), which prevents future sign-in and use of the Service, but does not erase your historical attendance or participation records.

## 6. Your Choices

- **Location**: you may decline location permission, but you will not be able to mark attendance via QR scan, as this is required to verify physical presence.
- **Camera**: required only for QR scanning; you may decline, but attendance scanning will not function.
- **Notifications**: optional; you may disable these at any time in your device settings.
- **Sign out**: you may sign out of the app at any time, which ends your active session on that device.
- **Account deactivation**: contact us using the details in Section 9 to request that your account be deactivated. This disables future access but does not delete your historical academic/attendance records, as explained in Section 5.

## 7. Children's Privacy

Our Service is intended exclusively for enrolled university students, faculty, and authorized staff of Newton School of Technology (NST), Pune and Ajeenkya DY Patil University (typically ages 17 and above). We do not knowingly collect or solicit personal information from children under the age of 13. If you believe that a child under 13 has provided us with personal information, please contact us immediately at [support@nstsdc.com](mailto:support@nstsdc.com) so that we can take appropriate measures.

## 8. Data Security

We use industry-standard measures to protect your data, including encrypted network connections (HTTPS) and access controls limiting who can view administrative or personal data. No system is perfectly secure, and we cannot guarantee absolute security.

## 9. Contact Us

If you have questions about this policy or wish to exercise your data rights, contact:

**NST Student Developer Club (nst-sdc)**  
Email: [support@nstsdc.com](mailto:support@nstsdc.com)  
Newton School of Technology (NST), Pune

## 10. Changes to This Policy

We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the updated policy.

---

This policy applies to both the NST Events mobile application (Android and iOS) and the NST Events web dashboard.$CONTENT$
    ),
    CURRENT_TIMESTAMP
);
