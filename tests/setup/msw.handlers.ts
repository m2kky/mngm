import { http, HttpResponse } from "msw";

export const handlers = [
  // Global defaults for MSW
  http.get("/api/auth/me", () => {
    return HttpResponse.json({
      id: "mock-user-1",
      email: "mock@example.com",
      role: "TEAM_MEMBER",
      agencyId: "mock-agency-1"
    });
  }),
];
