/**
 * A central inventory of application routes.
 * Used by E2E smoke tests and accessibility tests to automatically cover pages.
 */
export const APP_ROUTES = {
  // Routes accessible without authentication
  public: [
    "/login",
  ],
  
  // Routes accessible only by authenticated team members (OWNER, ADMIN, EMPLOYEE, etc.)
  protected: [
    "/dashboard",
    "/clients",
    "/projects",
    "/tasks",
    "/pages",
    "/files",
    "/chat",
    "/attendance",
    "/reports",
    "/team",
    "/settings",
    "/profile",
  ],
  
  // Routes accessible only by authenticated CLIENT role users
  clientPortal: [
    "/client-portal",
  ]
};
