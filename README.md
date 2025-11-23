# 🔐 Frontend Application Middleware

**Author**: Falodun Tunmise  
**Description**: Advanced authentication and authorization middleware for Next.js applications with role-based access control.

## 📖 Overview

This middleware provides robust route protection for multi-role applications, ensuring secure access control across different user types (Admin, Vendor, Delivery, Client). It handles authentication state management, role-based authorization, and automatic redirects with comprehensive error prevention.

## 🚀 Features

- **🔐 Authentication Guard**: Protects private routes from unauthenticated access
- **👥 Role-Based Authorization**: Restricts route access based on user roles
- **🔄 Smart Redirects**: Automatic redirection to appropriate login/dashboard pages
- **🛡️ Security First**: Handles corrupted auth states and invalid tokens
- **⚡ Performance Optimized**: Early returns and efficient route matching
- **🔧 Extensible Design**: Easy to add new roles and route patterns

## 🏗️ Architecture

### Core Components

```typescript
// Route Configuration
PUBLIC_ROUTES: string[]          // Accessible without authentication
EXCLUDED_PATHS: string[]         // Completely excluded from middleware
ROLE_ACCESS_MAP: Record<string, string[]>  // Role-to-route permissions
ROLE_DASHBOARD_MAP: Record<string, string> // Default dashboards per role
```

### User Roles Supported

| Role | Access Prefix | Default Dashboard |
|------|---------------|-------------------|
| `ADMIN` | `/admin`, `/dashboard` | `/admin/dashboard` |
| `VENDOR` | `/supplier` | `/supplier/dashboard` |
| `DELIVERY` | `/courier` | `/courier/dashboard` |
| `CLIENT` | `/account`, `/orders`, `/cart` | `/account` |

## 🔄 Algorithm Flowchart

```
Request Incoming
        ↓
[1] Check Excluded Paths
    ↓
    ┌─ Static assets, API routes → ALLOW
    ↓
[2] Check Public Routes
    ↓
    ┌─ Public route + No auth → ALLOW
    ├─ Public route + Has auth → Redirect to dashboard
    ↓
[3] Authentication Check
    ↓
    ┌─ No token → Redirect to role-specific login
    ↓
[4] Authorization Check
    ↓
    ┌─ Invalid role → Clear cookies + Redirect to login
    ├─ Wrong role access → Redirect to role dashboard
    ↓
[5] ALLOW Access
```

## 📋 Detailed Algorithm

### Step 1: Path Exclusion Check
```typescript
// Immediately allow static assets and API routes
EXCLUDED_PATHS = ["/_next", "/api", "/public", "/favicon.ico"]
```

### Step 2: Public Route Validation
```typescript
// Allow access to public routes
PUBLIC_ROUTES = ["/", "/login", "/admin/login", ...]

// Special case: Authenticated users accessing login pages get redirected to their dashboard
if (authenticated && accessingLoginPage) {
    redirectTo(ROLE_DASHBOARD_MAP[role]);
}
```

### Step 3: Authentication Gate
```typescript
if (!token) {
    // Determine login page based on accessed route
    loginPath = determineLoginPath(currentPath);
    redirectTo(loginPath);
}
```

### Step 4: Authorization Layer
```typescript
if (role) {
    if (accessingProtectedRoute && !hasRoleAccess(role, currentPath)) {
        redirectTo(ROLE_DASHBOARD_MAP[role]);
    }
} else {
    // Corrupted auth state - clear invalid data
    clearAuthCookies();
    redirectTo("/login");
}
```

### Step 5: Access Grant
```typescript
return NextResponse.next(); // All checks passed
```

## 🛠️ Installation & Usage

### 1. File Structure
```
middleware.js        # Root middleware file
app/
  ├── admin/
  ├── supplier/
  ├── courier/
  ├── account/
  └── login/
```

### 2. Required Cookies
The middleware expects these cookies to be set after authentication:
```javascript
// After successful login
cookies.set('access_token', 'jwt-token-here');
cookies.set('user_role', 'ADMIN'); // or VENDOR, DELIVERY, CLIENT
```

### 3. Configuration
Update the middleware configuration in `config` object:
```javascript
export const config = {
  matcher: [
    "/admin/:path*",
    "/supplier/:path*",
    "/courier/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    // Add new protected routes here
  ],
};
```

## 🔧 Customization

### Adding New Roles
```typescript
const ROLE_ACCESS_MAP = {
    // ... existing roles
    MANAGER: ["/manager", "/reports"],
};

const ROLE_DASHBOARD_MAP = {
    // ... existing dashboards
    MANAGER: "/manager/analytics",
};
```

### Adding New Public Routes
```typescript
const PUBLIC_ROUTES = [
    // ... existing routes
    "/new-public-route",
    "/another-public-route",
];
```

## 🚨 Error Handling

### Infinite Redirect Prevention
The middleware includes safeguards against redirect loops:
- Clear separation of public vs protected routes
- Proper handling of authenticated users on login pages
- Excluded paths for static assets

### Corrupted Auth State
```typescript
if (token && !role) {
    // Clear invalid auth data
    response.cookies.delete("access_token");
    response.cookies.delete("user_role");
    redirectTo("/login");
}
```

## 📝 Route Examples

### ✅ Allowed Access Patterns
| User Role | Accessing | Result |
|-----------|-----------|---------|
| Admin | `/admin/users` | ✅ Allowed |
| Vendor | `/supplier/products` | ✅ Allowed |
| Client | `/account/profile` | ✅ Allowed |
| Any (no auth) | `/login` | ✅ Allowed |

### ❌ Restricted Access Patterns
| User Role | Accessing | Result |
|-----------|-----------|---------|
| Client | `/admin/dashboard` | ❌ Redirect to `/account` |
| Vendor | `/courier/orders` | ❌ Redirect to `/supplier/dashboard` |
| Any (no auth) | `/account` | ❌ Redirect to `/login` |

## 🔍 Debugging

### Common Issues

1. **Infinite Redirects**
   - Check PUBLIC_ROUTES includes all login pages
   - Verify matcher config doesn't include public routes

2. **Wrong Redirects**
   - Validate role cookies are set correctly
   - Check ROLE_ACCESS_MAP configuration

3. **Middleware Not Triggering**
   - Ensure file is in root directory
   - Verify matcher paths match your route structure

### Debug Mode
Add logging for development:
```typescript
if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] Path: ${pathname}, Role: ${role}, Action: ${action}`);
}
```

## 🤝 Contributing

When extending this middleware:

1. Maintain the clear logical flow
2. Update documentation for new features
3. Test redirect scenarios thoroughly
4. Follow the existing configuration pattern

## 📄 License

This middleware is part of the frontend application architecture developed by Falodun Tunmise.

---

**Maintained by**: Falodun Tunmise  
**Last Updated**: ${new Date().toLocaleDateString()}
