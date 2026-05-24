import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // A standard smoke load scenario
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users over 30 seconds
    { duration: '1m', target: 10 },  // Stay at 10 users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
  },
};

const BASE_URL = __ENV.VITE_APP_URL || 'http://localhost:5000';

export default function () {
  // Safe endpoints for load testing (unauthenticated routes)
  const res = http.get(`${BASE_URL}/login`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
}
