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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept API / data requests with page-level HTML redirects.
  // Bypass proxy for requests carrying API client headers or JSON accepts so
  // next.config.ts rewrites and backend API handlers can process them.
  const isApiRequest =
    request.headers.has('x-client-platform') ||
    request.headers.has('authorization') ||
    request.headers.get('accept')?.includes('application/json') ||
    (request.method !== 'GET' && request.method !== 'HEAD');

  if (isApiRequest) {
    return NextResponse.next();
  }

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
    pathname.startsWith('/clubs/') ||
    pathname === '/notifications' ||
    pathname.startsWith('/notifications/');

  if (isAdminRoute) {
    // 1. If explicit STUDENT role hint is present, redirect to student portal
    if (userRole === 'STUDENT') {
      const destination =
        pathname === '/notifications' || pathname.startsWith('/notifications/')
          ? '/student/notifications'
          : '/student/home';
      const studentUrl = new URL(destination, request.url);
      return NextResponse.redirect(studentUrl);
    }

    // 2. Unauthenticated requests (no role cookie) or unrecognized roles must be redirected to /login.
    // Client-controlled user_role cookie acts as an edge presentation routing hint. Authoritative
    // cryptographic session validation is enforced client-side by AppLayout (/auth/refresh) and by
    // the Express API on every data request.
    if (!userRole || !ADMIN_ROLES.includes(userRole)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('return_to', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protected student routes under (student)
  const isStudentRoute = pathname === '/student' || pathname.startsWith('/student/');
  if (isStudentRoute) {
    if (!userRole) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('return_to', pathname);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Aliases for backwards compatibility with tests and consumers
export { proxy as middleware };
export default proxy;

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
    '/notifications',
    '/notifications/:path*',
    '/student',
    '/student/:path*',
  ],
};
