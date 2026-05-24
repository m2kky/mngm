import { setupServer } from "msw/node";
import { handlers } from "./msw.handlers";

// Setup MSW Node server
export const server = setupServer(...handlers);
