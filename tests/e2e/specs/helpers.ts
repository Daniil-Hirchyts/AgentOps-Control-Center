import { expect, type Browser, type BrowserContext, type Page, request } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const PASSWORD = 'e2e-password-123';

export interface TestUser {
  id: number;
  username: string;
  role: 'OPERATOR' | 'REVIEWER';
}

/** Creates a fresh synthetic account through the mandatory REST endpoint. */
export async function createUser(prefix: string, role: TestUser['role']): Promise<TestUser> {
  const api = await request.newContext({ baseURL: BASE });
  const username = `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 32);
  const res = await api.post('/api/comptes', { data: { username, password: PASSWORD, role } });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as TestUser;
  await api.dispose();
  return body;
}

export async function apiToken(username: string): Promise<string> {
  const api = await request.newContext({ baseURL: BASE });
  const res = await api.post('/api/auth/login', { data: { username, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const { accessToken } = (await res.json()) as { accessToken: string };
  await api.dispose();
  return accessToken;
}

/** Opens an isolated browser context (separate cookies/storage = separate device) and logs in via the UI. */
export async function loginInNewContext(
  browser: Browser,
  user: TestUser,
  opts: { mobile?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(
    opts.mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {},
  );
  const page = await context.newPage();
  await login(page, user);
  return { context, page };
}

export async function login(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(user.username);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(user.role === 'OPERATOR' ? /\/operator/ : /\/reviewer/);
  await expect(page.getByTestId('ws-status').first()).toContainText(/connected/i);
}

export async function openConversation(page: Page, other: TestUser) {
  await page.goto(`/messages/${other.id}`);
  await expect(page.getByTestId('conversation')).toBeVisible();
}

export async function sendMessage(page: Page, text: string) {
  await page.getByTestId('message-input').fill(text);
  await page.getByTestId('send-button').click();
}
