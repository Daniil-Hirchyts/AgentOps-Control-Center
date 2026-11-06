import { expect, test } from '@playwright/test';
import { apiToken, createUser, loginInNewContext } from './helpers';

test('Scenario C — rejected action never executes', async ({ browser }) => {
  const op = await createUser('e2e_op', 'OPERATOR');
  const rev = await createUser('e2e_rev', 'REVIEWER');
  const token = await apiToken(op.username);
  const o = await loginInNewContext(browser, op);
  const r = await loginInNewContext(browser, rev, { mobile: true });
  const auth = { Authorization: `Bearer ${token}` };

  const created = await o.page.request.post('/api/cases', {
    headers: auth,
    data: {
      title: 'E2E rejection case',
      invoice: {
        invoiceNumber: 'E2E-REJ-1', vendor: 'Synthetic Vendor SAS', amount: 25000, currency: 'EUR',
        issueDate: '2026-10-20', description: 'Synthetic test invoice', historicalAverage: 3000,
      },
    },
  });
  expect(created.status()).toBe(201);
  const kase = await created.json();

  await o.page.goto(`/operator/cases/${kase.id}`);
  await o.page.getByTestId('run-analysis-button').click();
  await o.page.getByTestId(`reviewer-option-${rev.username}`).click();
  await o.page.getByTestId('start-run-submit').click();
  await expect(o.page).toHaveURL(/\/operator\/runs\/\d+/);
  const runId = Number(o.page.url().match(/runs\/(\d+)/)![1]);
  await expect(o.page.getByTestId('run-status').first()).toContainText(/awaiting approval/i);

  await r.page.goto('/reviewer');
  await r.page.getByTestId('approval-list').locator('[data-testid^="approval-card-"]').first().click();
  await r.page.getByTestId('reject-button').click();
  await r.page.getByTestId('decision-reason').fill('Facture conforme au contrat.');
  await r.page.getByTestId('confirm-decision').click();
  await expect(r.page.getByTestId('approval-status').first()).toContainText(/rejected/i);

  // Operator sees the final state live.
  await expect(o.page.getByTestId('run-status').first()).toContainText(/cancelled/i);

  const run = await (await o.page.request.get(`/api/agent-runs/${runId}`, { headers: auth })).json();
  expect(run.status).toBe('CANCELLED');
  expect(run.approval.status).toBe('REJECTED');
  const after = await (await o.page.request.get(`/api/cases/${kase.id}`, { headers: auth })).json();
  expect(after.status).toBe('OPEN');
  const audit = await (await o.page.request.get(`/api/audit-events?agentRunId=${runId}&limit=200`, { headers: auth })).json();
  const types: string[] = audit.items.map((e: { eventType: string }) => e.eventType);
  expect(types).toContain('approval_decided');
  expect(types).not.toContain('action_executed');

  // Second decision attempt is refused (no replay).
  const rtoken = await apiToken(rev.username);
  const replay = await o.page.request.post(`/api/approvals/${run.approval.id}/decision`, {
    headers: { Authorization: `Bearer ${rtoken}` },
    data: { decision: 'approve' },
  });
  expect(replay.status()).toBe(409);

  await o.context.close();
  await r.context.close();
});
