import { NextResponse } from "next/server";

/**
 * Authentication & Authorization Middleware
 * 
 * Algorithm Overview:
 * 1. Extract request details (URL, cookies)
 * 2. Check if current route is public - allow immediate access
 * 3. Check authentication (token exists) - redirect to login if not
 * 4. Check authorization (role-based access) - redirect to dashboard if unauthorized
 * 5. Allow access if all checks pass
 * 
 * Error Prevention Strategies:
 * - Avoid infinite redirects by carefully managing public vs protected routes
 * - Use exact matches and proper route grouping
 * - Implement clear fallback behaviors
 */

export function middleware(request) {
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
  // Extract authentication data from cookies
  const token = request.cookies.get("access_token")?.value;
  const role = request.cookies.get("user_role")?.value;

  /**
   * Route Configuration
   * Organized by access level and purpose for maintainability
   */
  
  // Public routes that don't require authentication
  const PUBLIC_ROUTES = [
    "/",
    "/public",
    "/login",
    "/register",
    "/admin/login", 
    "/supplier/login",
    "/courier/login",
    "/reset-password",
    "/forgot-password",
    "/verify-signup",
    "/callback"
  ];

  // Static assets and API routes that should be excluded from middleware
  const EXCLUDED_PATHS = [
    "/_next",
    "/api",
    "/public",
    "/favicon.ico"
  ];

  // Role-based route access configuration
  const ROLE_ACCESS_MAP = {
    ADMIN: ["/admin", "/dashboard"],
    VENDOR: ["/supplier"],
    DELIVERY: ["/courier"],
    CLIENT: ["/account", "/orders", "/cart", "/notifications"]
  };

  // Default dashboard redirects for each role
  const ROLE_DASHBOARD_MAP = {
    ADMIN: "/admin/dashboard",
    VENDOR: "/supplier/dashboard", 
    DELIVERY: "/courier/dashboard",
    CLIENT: "/account"
  };

  /**
   * Middleware Logic Flow
   */

  // Step 1: Check for excluded paths (static assets, API routes)
  const isExcludedPath = EXCLUDED_PATHS.some(path => pathname.startsWith(path));
  if (isExcludedPath) {
    return NextResponse.next();
  }

  // Step 2: Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    // Exact match for root and specific routes
    if (route === "/" && pathname === "/") return true;
    // Prefix match for nested public routes
    return pathname.startsWith(route);
  });

  if (isPublicRoute) {
    // If user is already authenticated and trying to access login pages,
    // redirect them to their appropriate dashboard
    if (token && role) {
      const isLoginRoute = [
        "/login", 
        "/admin/login", 
        "/supplier/login", 
        "/courier/login"
      ].some(route => pathname.startsWith(route));
      
      if (isLoginRoute) {
        url.pathname = ROLE_DASHBOARD_MAP[role] || "/";
        return NextResponse.redirect(url);
      }
    }
    
    return NextResponse.next();
  }

  // Step 3: Authentication Check
  if (!token) {
    // Determine appropriate login page based on the accessed route
    let loginPath = "/login";
    
    if (pathname.startsWith("/admin")) {
      loginPath = "/admin/login";
    } else if (pathname.startsWith("/supplier")) {
      loginPath = "/supplier/login";
    } else if (pathname.startsWith("/courier")) {
      loginPath = "/courier/login";
    }
    
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  // Step 4: Authorization Check (Role-based Access Control)
  if (role) {
    // Get all protected route prefixes for the current path
    const currentProtectedRoutes = Object.values(ROLE_ACCESS_MAP).flat();
    const isProtectedRoute = currentProtectedRoutes.some(route => 
      pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      // Check if user's role has access to the current route
      const userAllowedRoutes = ROLE_ACCESS_MAP[role] || [];
      const hasAccess = userAllowedRoutes.some(allowedRoute => 
        pathname.startsWith(allowedRoute)
      );

      if (!hasAccess) {
        // User doesn't have permission - redirect to their dashboard
        url.pathname = ROLE_DASHBOARD_MAP[role] || "/";
        return NextResponse.redirect(url);
      }
    }
  } else {
    // User has token but no role - this might indicate corrupted auth state
    // Clear invalid auth data and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("access_token");
    response.cookies.delete("user_role");
    return response;
  }

  // Step 5: All checks passed - allow request to proceed
  return NextResponse.next();
}

/**
 * Middleware Configuration
 * Only apply middleware to routes that need protection
 * This prevents unnecessary middleware execution and potential redirect loops
 */
export const config = {
  matcher: [
    /*
     * Protect all dashboard and authenticated user routes
     * Using specific matchers prevents middleware from running on public routes
     */
    "/admin/:path*",
    "/supplier/:path*", 
    "/courier/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    "/orders/:path*",
    "/cart/:path*",
    "/notifications/:path*",
    
    /*
     * Explicitly exclude public routes to prevent redirect loops
     * These are handled in the PUBLIC_ROUTES check above
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)"
  ],
};
