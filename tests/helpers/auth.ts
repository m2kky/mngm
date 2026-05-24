import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-do-not-use-in-production";

export function generateTestToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });
}

export function generateAuthHeader(userId: string) {
  return `Bearer ${generateTestToken(userId)}`;
}

export function generateCustomToken(payload: any, secret: string = JWT_SECRET) {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}
