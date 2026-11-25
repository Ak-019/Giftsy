import { beforeEach, expect, test, vi } from 'vitest';
import api, { imageUrl, refreshSession, setAccessToken, setOnSessionExpired } from '../src/api/client';

// A fake network layer: lets each test decide how the "server" answers
let handler;
api.defaults.adapter = (config) => handler(config);
const reply = (config, status, data) => {
  if (status >= 400) {
    const err = new Error(`HTTP ${status}`);
    err.config = config;
    err.response = { status, data, config };
    return Promise.reject(err);
  }
  return Promise.resolve({ status, data, headers: {}, config, statusText: 'OK' });
};

beforeEach(() => setAccessToken(null));

test('sends the CSRF header, cookies and the access token', async () => {
  setAccessToken('abc');
  handler = (config) => reply(config, 200, { headers: config.headers, withCredentials: config.withCredentials });
  const { data } = await api.get('/cart');
  expect(data.headers.Authorization).toBe('Bearer abc');
  expect(data.headers['X-Requested-With']).toBe('XMLHttpRequest');
  expect(data.withCredentials).toBe(true);
});

test('an expired access token is refreshed once and the request retried', async () => {
  setAccessToken('old');
  const calls = [];
  handler = (config) => {
    calls.push(`${config.url} ${config.headers.Authorization}`);
    if (config.url === '/auth/refresh') return reply(config, 200, { accessToken: 'new', user: {} });
    return config.headers.Authorization === 'Bearer new' ? reply(config, 200, { ok: true }) : reply(config, 401, {});
  };
  // two requests fail at the same time: only ONE refresh call should happen
  const [a, b] = await Promise.all([api.get('/cart'), api.get('/orders/my')]);
  expect(a.data.ok && b.data.ok).toBe(true);
  expect(calls.filter((c) => c.startsWith('/auth/refresh'))).toHaveLength(1);
});

test('if refresh fails, the session-expired callback runs', async () => {
  setAccessToken('old');
  const expired = vi.fn();
  setOnSessionExpired(expired);
  handler = (config) => reply(config, 401, { message: 'nope' });
  await expect(api.get('/cart')).rejects.toBeTruthy();
  expect(expired).toHaveBeenCalledTimes(1);
});

test('refreshSession stores the new token', async () => {
  handler = (config) => reply(config, 200, { accessToken: 'fresh', user: { name: 'A' } });
  const data = await refreshSession();
  expect(data.user.name).toBe('A');
  handler = (config) => reply(config, 200, { auth: config.headers.Authorization });
  expect((await api.get('/x')).data.auth).toBe('Bearer fresh');
});

test('imageUrl handles uploads, links and missing images', () => {
  expect(imageUrl('/uploads/a.jpg')).toBe('/uploads/a.jpg');
  expect(imageUrl('https://x.com/a.jpg')).toBe('https://x.com/a.jpg');
  expect(imageUrl(undefined)).toBe('/placeholder.svg');
});
