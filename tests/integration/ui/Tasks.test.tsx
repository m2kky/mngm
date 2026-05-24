// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../../helpers/render-with-providers";
import Tasks from "../../../client/src/pages/Tasks";

describe("Tasks UI Integration", () => {
  it("renders the tasks page without crashing", () => {
    // React Query is provided, auth is mocked by MSW in beforeAll setup
    const { container } = renderWithProviders(<Tasks />);
    expect(container).toBeTruthy();
    // Assuming the page renders a generic layout or title initially
    // We can just assert it didn't throw and mounted properly.
  });
});
