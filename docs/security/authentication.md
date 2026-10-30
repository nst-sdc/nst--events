# Authentication Architecture

This document defines the complete end-to-end identity, authentication, and session lifecycle for the NST-Events platform across web and mobile clients.

---

## 1. High-Level Authentication Model

NST-Events uses a **hybrid authentication model**:
- **Identity Provider:** Google OAuth 2.0 (restricted to institutional Google accounts).
- **Access Tokens:** Short-lived (15-minute) stateless JWTs carrying user ID and a security version.
- **Refresh Tokens:** Database-backed, opaque random strings stored as SHA-256 hashes with **Token Family Rotation** and automatic reuse detection.
- **Storage Strategy:**
  - **Web (Dashboard):** In-memory access token + `HttpOnly`, `SameSite=Strict`, `Secure`, `path=/auth` refresh cookie. Access tokens are **never** stored in `localStorage` or `sessionStorage`.
  - **Mobile (Expo / React Native):** Hardware-backed encrypted storage via `expo-secure-store` (iOS Keychain / Android Keystore) for both access and refresh tokens.

---

## 2. End-to-End Authentication Sequences

### 2.1 Web Authentication Flow (Dashboard)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Dashboard (Next.js)
    participant API as Express API
    participant Google as Google OAuth 2.0
    participant DB as PostgreSQL 16

    User->>Web: Clicks "Sign in with Google"
    Web->>API: GET /auth/google?platform=web
    API-->>Web: Set-Cookie: oauth_state=<state>:web (HttpOnly, SameSite=Lax) + 302 to Google
    Web->>Google: Authenticates with institutional Google account
    Google-->>API: 302 GET /auth/google/callback?code=<code>&state=<state>:web
    Note over API: Verifies oauth_state cookie against query param
    API->>Google: Exchange code for id_token & verify audience
    API->>DB: SELECT * FROM upsert_oauth_user(sub, email, name)
    API->>DB: First-login: parse email -> user_academic_profiles
    API->>DB: INSERT INTO refresh_tokens (token_hash, family_id, expires_at)
    API-->>Web: 303 Redirect to /dashboard + Set-Cookie: refreshToken=<token> (HttpOnly, Strict, path=/auth)
    Web->>API: POST /auth/refresh (credentials: include)
    API-->>Web: 200 { access_token, expires_in: 900 }
    Note over Web: Stores access_token in memory only
```

### 2.2 Mobile Authentication Flow (Expo / React Native)

Mobile authentication is standardized exclusively on native Google Sign-In (Method B). The browser deep-link flow (Method A) is deprecated.

#### Method A: Deep-Link Code Exchange (Web Browser OAuth) — [DEPRECATED]
> [!WARNING]
> **DEPRECATED & CANDIDATE FOR REMOVAL**:
> The browser deep-link OAuth flow is deprecated. Native Google Sign-In (`POST /auth/mobile/login-id-token`) is the only supported mobile authentication flow.
>
> The corresponding backend endpoints and mechanisms are retained for legacy compatibility but are candidates for removal:
> - `POST /auth/mobile/exchange` (`apps/api/src/modules/auth/auth.router.ts`)
> - Mobile deep-link redirection branch in `GET /auth/google/callback` (`platform === 'mobile'`)
> - In-memory single-use code storage (`apps/api/src/modules/auth/mobile-auth-codes.ts`)

1. Mobile app opens system browser to `GET /auth/google?platform=mobile`.
2. After Google callback, the API creates a cryptographically random, single-use **Mobile Auth Code** (`CODE_TTL_MS = 60_000` via `apps/api/src/modules/auth/mobile-auth-codes.ts`).
3. API redirects browser to mobile custom scheme: `nst-events://(auth)/callback?code=<mobileCode>`.
4. Mobile app captures deep link and calls:
   ```http
   POST /auth/mobile/exchange
   Content-Type: application/json

   { "code": "<mobileCode>" }
   ```
5. API consumes the single-use code immediately (deleting it to prevent reuse) and returns:
   ```json
   {
     "access_token": "<jwt>",
     "refresh_token": "<raw_refresh_token>",
     "expires_in": 900
   }
   ```
6. Mobile app saves `access_token`, `refresh_token`, and `user_id` into `expo-secure-store`.

#### Method B: Native Google Sign-In (`id_token` Direct Exchange) — [ONLY SUPPORTED MOBILE FLOW]
1. Mobile app utilizes native Google Sign-In SDK (`@react-native-google-signin/google-signin`) to acquire a Google `id_token`.
2. Mobile app calls:
   ```http
   POST /auth/mobile/login-id-token
   Content-Type: application/json

   { "id_token": "<google_id_token>" }
   ```
3. API validates the ID token against Google's public keys, enforces domain restrictions, upserts user, issues tokens, and returns the token pair directly in the JSON response:
   ```json
   {
     "access_token": "<jwt>",
     "refresh_token": "<raw_refresh_token>",
     "expires_in": 900,
     "user": { ... }
   }
   ```
4. Mobile app saves `access_token`, `refresh_token`, and `user_id` into `expo-secure-store`.

---

## 3. Authenticated Request & Session Execution

Every authenticated request follows a strict verification pipeline:

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> Hdr{Authorization: Bearer token?}
    Hdr -- No --> E401[401 Unauthorized]
    Hdr -- Yes --> JWT[verifyJwt: Signature & Expiration Check]
    JWT -- Invalid/Expired --> E401
    JWT -- Valid --> Ctx[withUserContext: SELECT user by sub]
    Ctx --> SoftDel{deleted_at != null?}
    SoftDel -- Yes --> E403[403 Account Deactivated]
    SoftDel -- No --> SecVer{user.security_version == payload.secVer?}
    SecVer -- No --> E401Revoked[401 Session Revoked: Access change]
    SecVer -- Yes --> Attach[Attach req.user = id]
    Attach --> Next[Express RBAC Middleware & Controller]
```

---

## 4. Transparent Token Refresh Lifecycle

Access tokens expire after **15 minutes** (`900 seconds`). Both web and mobile implement automatic, transparent token refresh without user disruption:

### 4.1 Web Interceptor Flow (`apps/dashboard/lib/api.ts`)
1. An API request returns `401 Unauthorized`.
2. The dashboard interceptor holds pending requests using a shared `refreshPromise`.
3. Calls `POST /auth/refresh` with `credentials: 'include'`.
4. The browser automatically attaches the `refreshToken` cookie.
5. On `200 OK`, updates the in-memory access token and replays original failed request.
6. If `/auth/refresh` returns `401`, in-memory auth is purged, and the browser redirects to `/login`.

### 4.2 Mobile Interceptor Flow (`apps/mobile/src/store/auth.ts`)
1. An API request returns `401 Unauthorized`.
2. Mobile calls `POST /auth/refresh` using `fetch()` directly with `{ "refresh_token": "<stored_token>" }`.
3. On `200 OK`, updates `expo-secure-store` with new `access_token` and rotated `refresh_token`.
4. If refresh fails, `clearSession()` is called: deletes all SecureStore keys and purges the React Query cache.

---

## 5. Logout & Revocation Lifecycle
 
When a user logs out (`POST /auth/logout`):
1. **Server-Side Token Revocation:**
   The backend extracts the refresh token from cookie or JSON body (`{ "refresh_token": "<token>" }`), hashes it (`SHA-256`), and revokes the token family:
   ```sql
   SELECT revoke_refresh_token_family(${token.family_id}::uuid);
   ```
   This immediately invalidates all refresh tokens in the family.
   Mobile clients transmit `{ "Content-Type": "application/json", "Authorization": "Bearer <access_token>" }` with body `JSON.stringify({ refresh_token })` (without manual `Cookie` headers).
2. **Cookie Destruction:**
   The server issues `Set-Cookie: refreshToken=; Max-Age=0; Path=/auth; HttpOnly; SameSite=Strict`.
3. **Client-Side Cache Purge:**
   - **Web:** Clears in-memory access token, `user_role` cookie, React Query cache, and redirects to `/login`.
   - **Mobile:** Deletes `access_token`, `user_id`, and `refresh_token` from `expo-secure-store` and executes `queryClient.clear()` to eliminate cross-session data leaks. Local cleanup runs deterministically even if the network call times out or rejects.
