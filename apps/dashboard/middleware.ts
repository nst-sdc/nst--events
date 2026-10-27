import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Recognized administrative roles eligible to view operations dashboard.
 *
 * THREAT BOUNDARY & ARCHITECTURAL INVARIANT:
 * The `user_role` cookie is strictly a presentation and routing optimization hint.
 * It is NEVER trusted as authoritative authorization.
 * Authoritative authorization is enforced by the Express backend on every request
 * via cryptographically verified Bearer JWTs and PostgreSQL database checks (withUserContext),
 * and client-side by AppLayout using live `/v1/users/me` profile data.
 */
const ADMIN_ROLES = ['PLATFORM_ADMIN', 'FACULTY_ADMIN', 'FACULTY_MENTOR'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userRole = request.cookies.get('user_role')?.value;

  // Protected operations and admin routes under (app)
  const isAdminRoute =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/events' ||
    pathname.startsWith('/events/') ||
    pathname === '/clubs' ||
    pathname.startsWith('/clubs/');

  if (isAdminRoute) {
    // 1. If explicit STUDENT role hint is present, redirect to student portal
    if (userRole === 'STUDENT') {
      const studentUrl = new URL('/student/home', request.url);
      return NextResponse.redirect(studentUrl);
    }

    const hasRefreshToken = request.cookies.has('refreshToken');

    // 2. Session token is mandatory for protected operations/admin routes.
    // Client-controlled user_role cookie alone CANNOT establish an authenticated session.
    // Unauthenticated requests or forged admin cookies with no session must be redirected to /login.
    if (!hasRefreshToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('return_to', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
    '/events',
    '/events/:path*',
    '/clubs',
    '/clubs/:path*',
  ],
};
