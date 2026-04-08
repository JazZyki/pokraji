import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const teamId = request.cookies.get('knin_team_id');
  const { pathname } = request.nextUrl;

  // Pokud jde uživatel na mapu a nemá ID, přesměruj na home
  if (pathname.startsWith('/mapa') && !teamId) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Pokud už je přihlášený a jde na registraci, pošli ho rovnou na mapu
  if (pathname === '/' && teamId) {
    // Volitelné: return NextResponse.redirect(new URL('/mapa', request.url));
  }

  return NextResponse.next();
}

// Důležité: Middleware se spustí jen na těchto cestách
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};