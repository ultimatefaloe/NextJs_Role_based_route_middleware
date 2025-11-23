import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * User roles supported by the middleware
 */
export type UserRole = 'ADMIN' | 'VENDOR' | 'DELIVERY' | 'CLIENT';

/**
 * Authentication cookies structure
 */
interface AuthCookies {
  access_token?: string;
  user_role?: UserRole;
}

/**
 * Route configuration interfaces
 */
interface RouteConfiguration {
  PUBLIC_ROUTES: string[];
  EXCLUDED_PATHS: string[];
  ROLE_ACCESS_MAP: Record<UserRole, string[]>;
  ROLE_DASHBOARD_MAP: Record<UserRole, string>;
}

/**
 * Middleware response types
 */
type MiddlewareResponse = NextResponse<unknown>;

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

export function middleware(request: NextRequest): MiddlewareResponse {
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
  // Extract authentication data from cookies with proper typing
  const cookies: AuthCookies = {
    access_token: request.cookies.get("access_token")?.value,
    user_role: request.cookies.get("user_role")?.value as UserRole | undefined
  };

  const { access_token: token, user_role: role } = cookies;

  /**
   * Route Configuration
   * Organized by access level and purpose for maintainability
   */
  const routeConfig: RouteConfiguration = {
    // Public routes that don't require authentication
    PUBLIC_ROUTES: [
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
    ],

    // Static assets and API routes that should be excluded from middleware
    EXCLUDED_PATHS: [
      "/_next",
      "/api",
      "/public",
      "/favicon.ico"
    ],

    // Role-based route access configuration
    ROLE_ACCESS_MAP: {
      ADMIN: ["/admin", "/dashboard"],
      VENDOR: ["/supplier"],
      DELIVERY: ["/courier"],
      CLIENT: ["/account", "/orders", "/cart", "/notifications"]
    },

    // Default dashboard redirects for each role
    ROLE_DASHBOARD_MAP: {
      ADMIN: "/admin/dashboard",
      VENDOR: "/supplier/dashboard", 
      DELIVERY: "/courier/dashboard",
      CLIENT: "/account"
    }
  };

  const { PUBLIC_ROUTES, EXCLUDED_PATHS, ROLE_ACCESS_MAP, ROLE_DASHBOARD_MAP } = routeConfig;

  /**
   * Utility Functions with Type Safety
   */

  /**
   * Check if a path matches any of the excluded patterns
   */
  const isExcludedPath = (path: string): boolean => {
    return EXCLUDED_PATHS.some(excludedPath => path.startsWith(excludedPath));
  };

  /**
   * Check if a path is a public route
   */
  const isPublicRoute = (path: string): boolean => {
    return PUBLIC_ROUTES.some(publicRoute => {
      // Exact match for root and specific routes
      if (publicRoute === "/" && path === "/") return true;
      // Prefix match for nested public routes
      return path.startsWith(publicRoute);
    });
  };

  /**
   * Check if user is accessing a login route
   */
  const isLoginRoute = (path: string): boolean => {
    const loginRoutes = ["/login", "/admin/login", "/supplier/login", "/courier/login"];
    return loginRoutes.some(loginRoute => path.startsWith(loginRoute));
  };

  /**
   * Determine the appropriate login path based on the accessed route
   */
  const determineLoginPath = (path: string): string => {
    if (path.startsWith("/admin")) return "/admin/login";
    if (path.startsWith("/supplier")) return "/supplier/login";
    if (path.startsWith("/courier")) return "/courier/login";
    return "/login";
  };

  /**
   * Check if user has access to the current path based on their role
   */
  const hasRoleAccess = (userRole: UserRole, currentPath: string): boolean => {
    const userAllowedRoutes = ROLE_ACCESS_MAP[userRole] || [];
    return userAllowedRoutes.some(allowedRoute => 
      currentPath.startsWith(allowedRoute)
    );
  };

  /**
   * Check if the current path is protected (requires specific role access)
   */
  const isProtectedRoute = (path: string): boolean => {
    const allProtectedRoutes = Object.values(ROLE_ACCESS_MAP).flat();
    return allProtectedRoutes.some(protectedRoute => 
      path.startsWith(protectedRoute)
    );
  };

  /**
   * Clear authentication cookies from response
   */
  const clearAuthCookies = (response: NextResponse): void => {
    response.cookies.delete("access_token");
    response.cookies.delete("user_role");
  };

  /**
   * Middleware Logic Flow
   */

  // Step 1: Check for excluded paths (static assets, API routes)
  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  // Step 2: Check if current route is public
  if (isPublicRoute(pathname)) {
    // If user is already authenticated and trying to access login pages,
    // redirect them to their appropriate dashboard
    if (token && role && isLoginRoute(pathname)) {
      const dashboardPath = ROLE_DASHBOARD_MAP[role] || "/";
      url.pathname = dashboardPath;
      return NextResponse.redirect(url);
    }
    
    return NextResponse.next();
  }

  // Step 3: Authentication Check
  if (!token) {
    const loginPath = determineLoginPath(pathname);
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  // Step 4: Authorization Check (Role-based Access Control)
  if (role) {
    if (isProtectedRoute(pathname) && !hasRoleAccess(role, pathname)) {
      // User doesn't have permission - redirect to their dashboard
      url.pathname = ROLE_DASHBOARD_MAP[role] || "/";
      return NextResponse.redirect(url);
    }
  } else {
    // User has token but no role - this might indicate corrupted auth state
    // Clear invalid auth data and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookies(response);
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
