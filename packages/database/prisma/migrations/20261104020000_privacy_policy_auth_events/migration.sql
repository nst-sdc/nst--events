-- Update privacy policy in system_policies table to document auth events, IP pepper hashing, CIDR classification, 90-day retention, and privacy guarantees
UPDATE "system_policies"
SET 
    "published_content" = $CONTENT$# Privacy Policy — NST Events

**Effective date:** September 9, 2026  
**Last updated:** November 4, 2026

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

### 2.5 Usage, Authentication, and Account Activity

We log certain actions for security, fraud prevention, and auditing purposes:

- **Authentication Event Log**: For security monitoring and unauthorized access detection, authentication attempts (successful logins, logouts, token refresh failures, session revocations, and suspicious token reuse) are recorded in an auth event log.
- **Privacy Protections in Auth Logging**:
  - **IP Addresses**: Your IP address is never stored in plain text. It is pseudonymized immediately upon receipt using an HMAC-SHA256 one-way cryptographic hash with an isolated secret pepper (`AUTH_EVENTS_IP_PEPPER`).
  - **Campus Network Classification**: IP addresses are classified into CIDR network categories (`campus` vs `off_campus`) at the time of access to detect suspicious off-campus activity without persisting raw network identifiers.
  - **No Plaintext Passwords or Tokens**: Raw passwords, session tokens, or JWTs are never stored in the auth event log.
  - **Masking of Unrecognized User Identifiers**: If a sign-in attempt fails with an unrecognized email or non-whitelisted domain, the email address is masked to preserve domain information only (e.g., `*@external.com`), ensuring personal identifiers of unauthorized sign-in attempts are never persisted.
- **Administrative Audit Logs**: A record of administrative actions taken on the platform (e.g. attendance corrections, role changes, rate limit adjustments).

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

- **Academic & Attendance Records**: Attendance records, event participation history, and related administrative audit logs are retained **permanently as part of your institutional academic record**, in the same way attendance registers, transcripts, or grade records are retained by Newton School of Technology (NST), Pune. This data is not deleted when you graduate, leave the institution, or stop using the app, as it may be needed for academic integrity, dispute resolution, or institutional record-keeping purposes.
- **Authentication & Security Logs**: Authentication and traffic security logs (`auth_events`) are retained for a rolling window of **90 days** and are automatically purged thereafter by scheduled background worker jobs.

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
    "draft_content" = $CONTENT$# Privacy Policy — NST Events

**Effective date:** September 9, 2026  
**Last updated:** November 4, 2026

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

### 2.5 Usage, Authentication, and Account Activity

We log certain actions for security, fraud prevention, and auditing purposes:

- **Authentication Event Log**: For security monitoring and unauthorized access detection, authentication attempts (successful logins, logouts, token refresh failures, session revocations, and suspicious token reuse) are recorded in an auth event log.
- **Privacy Protections in Auth Logging**:
  - **IP Addresses**: Your IP address is never stored in plain text. It is pseudonymized immediately upon receipt using an HMAC-SHA256 one-way cryptographic hash with an isolated secret pepper (`AUTH_EVENTS_IP_PEPPER`).
  - **Campus Network Classification**: IP addresses are classified into CIDR network categories (`campus` vs `off_campus`) at the time of access to detect suspicious off-campus activity without persisting raw network identifiers.
  - **No Plaintext Passwords or Tokens**: Raw passwords, session tokens, or JWTs are never stored in the auth event log.
  - **Masking of Unrecognized User Identifiers**: If a sign-in attempt fails with an unrecognized email or non-whitelisted domain, the email address is masked to preserve domain information only (e.g., `*@external.com`), ensuring personal identifiers of unauthorized sign-in attempts are never persisted.
- **Administrative Audit Logs**: A record of administrative actions taken on the platform (e.g. attendance corrections, role changes, rate limit adjustments).

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

- **Academic & Attendance Records**: Attendance records, event participation history, and related administrative audit logs are retained **permanently as part of your institutional academic record**, in the same way attendance registers, transcripts, or grade records are retained by Newton School of Technology (NST), Pune. This data is not deleted when you graduate, leave the institution, or stop using the app, as it may be needed for academic integrity, dispute resolution, or institutional record-keeping purposes.
- **Authentication & Security Logs**: Authentication and traffic security logs (`auth_events`) are retained for a rolling window of **90 days** and are automatically purged thereafter by scheduled background worker jobs.

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
    "published_version" = "published_version" + 1,
    "published_at" = NOW(),
    "updated_at" = NOW()
WHERE "slug" = 'privacy-policy';
