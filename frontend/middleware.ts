import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const STAFF_AUTH_COOKIE = 'sqms_staff';

function base64UrlDecodeToJson(base64Url: string): any | null {
  try {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    // atob returns a binary string; decodeURIComponent trick supports unicode.
    const binary = atob(padded);
    const json = decodeURIComponent(
      Array.from(binary)
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getJwtRole(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = base64UrlDecodeToJson(parts[1]);
  const role = payload?.role;
  return typeof role === 'string' ? role : null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(STAFF_AUTH_COOKIE)?.value;

  // Protect staff dashboard + admin routes (auth)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  // Protect admin routes (role)
  if (pathname.startsWith('/admin')) {
    const role = getJwtRole(token);
    if (role !== 'ADMIN') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

