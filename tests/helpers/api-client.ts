import supertest from "supertest";
import express from "express";
import { registerRoutes } from "../../server/routes";

let testApp: express.Express | null = null;

export async function getTestApp() {
  if (testApp) return testApp;
  
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Register all routes
  await registerRoutes(app);
  
  testApp = app;
  return testApp;
}

export async function createApiClient() {
  const app = await getTestApp();
  return supertest(app);
}
