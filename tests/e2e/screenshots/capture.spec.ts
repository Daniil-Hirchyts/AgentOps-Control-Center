import { expect, test, type Page } from '@playwright/test';

const OUT = '../../docs/screenshots';
const PASSWORD = process.env.SEED_PASSWORD ?? 'demo-password-123';

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('ws-status').first()).toContainText(/connected/i);
}

test('capture report screenshots (alice desktop operator, bob mobile reviewer)', async ({ browser }) => {
  const desk = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const phone = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  ).newPage();
  await login(desk, 'alice');
  await login(phone, 'bob');

  const ids = await desk.evaluate(async () => {
    const r = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'X-Requested-With': 'agentops' } });
    const { accessToken } = await r.json();
    const h = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    const users = await (await fetch('/api/utilisateurs', { headers: h })).json();
    const cases = await (await fetch('/api/cases', { headers: h })).json();
    return { bob: users.find((u: { username: string }) => u.username === 'bob').id, alice: users.find((u: { username: string }) => u.username === 'alice').id, cases: cases.items, token: accessToken };
  });

  // Start a run on the suspicious seeded case, assigned to bob.
  const suspicious = ids.cases.find((c: { invoice: { amount: number } }) => c.invoice.amount > 40000);
  await desk.goto(`/operator/cases/${suspicious.id}`);
  await desk.getByTestId('run-analysis-button').click();
  await desk.getByTestId('reviewer-option-bob').click();
  await desk.getByTestId('start-run-submit').click();
  await expect(desk.getByTestId('run-status').first()).toContainText(/awaiting approval/i, { timeout: 120_000 }); // a real model takes a few seconds
  await desk.waitForTimeout(1200); // let the pipeline nodes finish their transition
  await desk.screenshot({ path: `${OUT}/desktop-run-awaiting-approval.png` });

  // Conversation on both devices.
  await desk.goto(`/messages/${ids.bob}`);
  await phone.goto(`/messages/${ids.alice}`);
  const send = async (p: Page, t: string) => {
    await p.getByTestId('message-input').fill(t);
    await p.getByTestId('send-button').click();
  };
  await send(desk, 'Hi Bob, the agent flagged invoice INV-2026-0912: 48,750 EUR against a typical 4,200 EUR.');
  await expect(phone.getByTestId('message-bubble').last()).toContainText('INV-2026-0912');
  await send(phone, 'Looking at the agent’s proposal right now.');
  await expect(desk.getByTestId('message-bubble').last()).toContainText('right now');
  await send(desk, 'Thanks. No purchase order matches it either.');
  await expect(phone.getByTestId('message-bubble').last()).toContainText('purchase order');
  // Let the message-enter transition (200ms) and presence settle before capturing.
  await expect(desk.getByTestId(`contact-bob`)).toContainText('Online');
  await desk.waitForTimeout(400);
  await desk.screenshot({ path: `${OUT}/desktop-messaging.png` });
  await phone.screenshot({ path: `${OUT}/mobile-messaging.png` });

  // Reviewer inbox + approval detail on mobile.
  await phone.goto('/reviewer');
  await expect(phone.locator('[data-testid^="approval-card-"]').first()).toBeVisible();
  await phone.screenshot({ path: `${OUT}/mobile-approval-inbox.png` });
  await phone.locator('[data-testid^="approval-card-"]').first().click();
  await expect(phone.getByTestId('approve-button')).toBeVisible();
  await phone.screenshot({ path: `${OUT}/mobile-approval-detail.png`, fullPage: true });

  await desk.goto('/operator');
  await desk.waitForTimeout(800);
  await desk.screenshot({ path: `${OUT}/desktop-dashboard.png` });
  await desk.getByTestId('new-case-button').click();
  await desk.getByTestId('scenario-spike').click();
  await expect(desk.getByTestId('case-preview')).toHaveAttribute('data-risk', 'high');
  await desk.waitForTimeout(300);
  await desk.screenshot({ path: `${OUT}/desktop-new-case.png` });
  await desk.keyboard.press('Escape');
  await desk.goto('/learn/concept');
  await desk.waitForTimeout(800);
  await desk.screenshot({ path: `${OUT}/desktop-concept.png` });
  await desk.goto('/learn/architecture');
  await desk.waitForTimeout(800);
  await desk.screenshot({ path: `${OUT}/desktop-architecture.png` });
  await desk.goto('/api/docs/');
  await desk.waitForTimeout(1500);
  await desk.screenshot({ path: `${OUT}/swagger-ui.png` });
});
