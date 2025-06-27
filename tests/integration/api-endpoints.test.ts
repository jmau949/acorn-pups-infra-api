/**
 * Integration tests for API endpoints
 * These tests require a deployed API Gateway to run
 */

describe('API Integration Tests', () => {
  const apiUrl = process.env.API_URL;

  beforeAll(() => {
    if (!apiUrl) {
      throw new Error('API_URL environment variable is required for integration tests');
    }
  });

  describe('Health Endpoint', () => {
    test('GET /health returns 200 and health status', async () => {
      const response = await fetch(`${apiUrl}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('status', 'healthy');
      expect(data.data).toHaveProperty('environment');
      expect(data.data).toHaveProperty('version');
      expect(data).toHaveProperty('requestId');
    });
  });

  describe('Device Management Endpoints', () => {
    test('POST /devices/register returns 401/403 without auth', async () => {
      const response = await fetch(`${apiUrl}/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: 'test-device-001',
          deviceName: 'Test Button',
          deviceType: 'acorn-button-v1',
          userId: 'test-user-001',
        }),
      });

      expect([401, 403]).toContain(response.status);
    });

    test('GET /users/{userId}/devices returns 401/403 without auth', async () => {
      const response = await fetch(`${apiUrl}/users/test-user-001/devices`);
      expect([401, 403]).toContain(response.status);
    });

    test('PUT /devices/{deviceId}/settings returns 401/403 without auth', async () => {
      const response = await fetch(`${apiUrl}/devices/test-device-001/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buttonSensitivity: 5,
          notificationPreferences: {
            pushEnabled: true,
            emailEnabled: false,
          },
        }),
      });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent returns 404', async () => {
      const response = await fetch(`${apiUrl}/nonexistent`);
      expect(response.status).toBe(404);
    });

    test('PATCH /health returns 405 (method not allowed)', async () => {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'PATCH',
      });
      expect([405, 404]).toContain(response.status);
    });
  });

  describe('CORS Headers', () => {
    test('OPTIONS requests return proper CORS headers', async () => {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'OPTIONS',
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });

    test('API responses include CORS headers', async () => {
      const response = await fetch(`${apiUrl}/health`);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
}); 