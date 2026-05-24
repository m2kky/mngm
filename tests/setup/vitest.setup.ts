import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./msw.server";

// Start MSW API mocking before all UI integration tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

// Close MSW after all tests
afterAll(() => {
  server.close();
});

// Reset handlers and clear all mocks after each test to prevent cross-test contamination
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
