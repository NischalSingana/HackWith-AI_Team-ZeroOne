import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define the routes that don't require authentication
const publicRoutes = ['/', '/login'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Allow access to API routes, Next.js static files, and public assets
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.includes('.') // matches files like favicon.ico, images, etc.
    ) {
        return NextResponse.next();
    }

    // 2. Check if the requested route is public
    const isPublicRoute = publicRoutes.includes(pathname);

    // 3. Get the token from cookies
    const token = request.cookies.get('auth_token')?.value;

    // 4. If no token and trying to access a protected route, redirect to login
    if (!token && !isPublicRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 5. If there's a token, verify it
    if (token) {
        try {
            // Verify the token using jose (Next.js Edge Runtime compatible)
            const secret = new TextEncoder().encode(
                process.env.JWT_SECRET || 'super_secret_fir_key_for_development_purposes_only'
            );
            
            await jwtVerify(token, secret);
            
            // If valid token and trying to access login page, redirect to dashboard
            if (pathname === '/login') {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
            
            return NextResponse.next();
        } catch (error) {
            console.error('🔒 Middleware JWT verification failed:', error);
            // If token is invalid/expired and not on a public route, delete cookie and redirect to login
            if (!isPublicRoute) {
                const response = NextResponse.redirect(new URL('/login', request.url));
                response.cookies.delete('auth_token');
                return response;
            }
        }
    }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
