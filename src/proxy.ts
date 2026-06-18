import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth/jwt';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard and all subpaths
  if (pathname.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get('squirryfy_session')?.value;
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const payload = await verifyToken(sessionCookie);
    if (!payload) {
      // Clear invalid cookie and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('squirryfy_session');
      return response;
    }
  }

  // Protect all /api/ endpoints EXCEPT /api/auth/login
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth/login')) {
    const sessionCookie = request.cookies.get('squirryfy_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(sessionCookie);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

// Configure routes to run middleware on
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
};
