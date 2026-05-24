/**
 * k6 Load Testing Script
 * 
 * Purpose:
 * This script runs a basic performance/load test to ensure the application
 * can handle a moderate volume of concurrent users without degrading performance.
 * It simulates users ramping up, holding steady, and ramping down.
 * 
 * Usage:
 * Install k6 locally (https://k6.io/docs/get-started/installation/)
 * Run: `k6 run tests/performance/load.js`
 * 
 * Or run via Docker without installing:
 * `docker run --rm -i grafana/k6 run - < tests/performance/load.js`
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users for 1 min
    { duration: '10s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // We hit the public health check endpoint or main page to simulate general traffic
  let res = http.get(`${BASE_URL}/api/health`);
  if (res.status === 404) {
    // fallback if no health endpoint exists
    res = http.get(`${BASE_URL}/login`);
  }
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
