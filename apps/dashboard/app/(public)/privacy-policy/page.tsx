/* eslint-disable react/no-unescaped-entities */
import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-black py-12 px-6 sm:px-12 md:px-24 lg:px-32">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="border-b pb-8 mb-8">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy — NST Events</h1>
          <p className="text-gray-600"><strong>Effective date:</strong> [DATE]</p>
          <p className="text-gray-600"><strong>Last updated:</strong> [DATE]</p>
        </header>

        <section className="space-y-4">
          <p>
            [CLUB NAME] ("we," "us," "our") operates the NST Events mobile and web applications (the "Service"), used by students and faculty of [COLLEGE NAME] to manage event registration and attendance.
          </p>
          <p>
            This policy explains what information we collect, why we collect it, and how it is stored and used. By using the Service, you agree to the practices described here.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">1. Who Can Use This Service</h2>
          <p>
            Access is restricted to individuals with an authorized institutional email address (currently <code>@adypu.edu.in</code> and <code>@newtonschool.co</code>). Sign-in is performed exclusively through Google Sign-In; we do not support or store separate passwords.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">2. Information We Collect</h2>
          
          <h3 className="text-xl font-medium mt-4">2.1 Account Information</h3>
          <p>When you sign in with Google, we receive and store:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your email address</li>
            <li>Your full name</li>
            <li>A unique Google account identifier</li>
            <li>Your profile picture URL, if available</li>
          </ul>
          <p>We use this to create and identify your account and to verify you belong to an authorized institution.</p>

          <h3 className="text-xl font-medium mt-4">2.2 Location Data</h3>
          <p>To mark attendance at an event, the app collects your device's <strong>precise GPS location</strong> at the moment you scan an event's attendance QR code. This is used solely to confirm you are physically present at the event venue (a "geofence" check). Location is requested only when you actively use the attendance-scanning feature — the app does not track your location in the background or at any other time.</p>
          <p>Along with your coordinates, we also record the reported GPS accuracy of that reading and whether your device flagged the location as a simulated/mock location, both used to detect fraudulent attendance attempts.</p>

          <h3 className="text-xl font-medium mt-4">2.3 Device Information</h3>
          <p>We collect a device identifier and device operating system (Android/iOS) at the time of attendance marking, and separately for push notification delivery. This helps us detect duplicate or fraudulent check-ins and deliver notifications to the correct device.</p>

          <h3 className="text-xl font-medium mt-4">2.4 Camera</h3>
          <p>The app requests camera access solely to scan QR codes for attendance. We do not store photos, video, or any camera data — the camera is used only to read the QR code displayed at an event.</p>

          <h3 className="text-xl font-medium mt-4">2.5 Usage and Account Activity</h3>
          <p>We log certain actions for security and auditing purposes, including:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>IP address and browser/device user-agent string, recorded at sign-in and stored with your session, to detect unauthorized access or token theft</li>
            <li>A record of administrative actions taken on the platform (e.g. attendance corrections, role changes)</li>
          </ul>

          <h3 className="text-xl font-medium mt-4">2.6 Push Notifications</h3>
          <p>If you enable notifications, your device is issued a push token (via Expo's push notification service) so we can deliver event reminders and updates. Notification content (such as event or club names) is transmitted through Expo's infrastructure to Apple and Google's push services to reach your device.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">3. How We Use Your Information</h2>
          <p>We use the information above to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Authenticate you and confirm your eligibility to use the Service</li>
            <li>Record and verify event attendance</li>
            <li>Detect and prevent fraudulent attendance (e.g. GPS spoofing, duplicate check-ins)</li>
            <li>Operate leaderboard, team, and event registration features</li>
            <li>Send you event-related notifications</li>
            <li>Investigate disputes or misuse of the platform</li>
            <li>Maintain the security of accounts and sessions</li>
          </ul>
          <p>We do not sell your information, and we do not use your data for advertising.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">4. Who We Share Information With</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Google</strong>: used solely for authentication (Google Sign-In). Google's own privacy policy governs the data it processes as part of that sign-in.</li>
            <li><strong>Expo (push notification infrastructure)</strong>: device push tokens and notification content pass through Expo's servers to reach Apple Push Notification service (APNs) and Firebase Cloud Messaging (FCM).</li>
            <li><strong>[COLLEGE NAME] staff/faculty administrators</strong>: authorized administrators and club officers can view attendance and registration data for events they organize, as necessary to run those events.</li>
          </ul>
          <p>We do not share your data with any other third party, and we do not use third-party analytics or advertising SDKs.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">5. Data Retention</h2>
          <p>Attendance records, event participation history, and related audit logs are retained <strong>permanently as part of your institutional academic record</strong>, in the same way attendance registers, transcripts, or grade records are retained by [COLLEGE NAME]. This data is not deleted when you graduate, leave the institution, or stop using the app, as it may be needed for academic integrity, dispute resolution, or institutional record-keeping purposes.</p>
          <p>We do not offer deletion of attendance or academic-activity records. You may request that your <strong>account access be deactivated</strong> (see Section 6), which prevents future sign-in and use of the Service, but does not erase your historical attendance or participation records.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">6. Your Choices</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Location</strong>: you may decline location permission, but you will not be able to mark attendance via QR scan, as this is required to verify physical presence.</li>
            <li><strong>Camera</strong>: required only for QR scanning; you may decline, but attendance scanning will not function.</li>
            <li><strong>Notifications</strong>: optional; you may disable these at any time in your device settings.</li>
            <li><strong>Sign out</strong>: you may sign out of the app at any time, which ends your active session on that device.</li>
            <li><strong>Account deactivation</strong>: contact us using the details in Section 8 to request that your account be deactivated. This disables future access but does not delete your historical academic/attendance records, as explained in Section 5.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">7. Data Security</h2>
          <p>We use industry-standard measures to protect your data, including encrypted network connections (HTTPS) and access controls limiting who can view administrative or personal data. No system is perfectly secure, and we cannot guarantee absolute security.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">8. Contact Us</h2>
          <p>If you have questions about this policy or wish to exercise your data rights, contact:</p>
          <address className="not-italic bg-gray-50 p-4 rounded-md border">
            <strong>[CLUB NAME]</strong><br />
            Email: [CONTACT EMAIL, e.g. clubname@newtonschool.co]<br />
            [COLLEGE NAME]
          </address>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mt-8">9. Changes to This Policy</h2>
          <p>We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
        </section>

        <footer className="mt-12 pt-8 border-t text-sm text-gray-500 text-center">
          <p>This policy applies to both the NST Events mobile application (Android and iOS) and the NST Events web dashboard.</p>
        </footer>
      </div>
    </div>
  );
}
