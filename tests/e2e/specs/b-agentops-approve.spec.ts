import { expect, test } from '@playwright/test';
import { apiToken, createUser, loginInNewContext, openConversation, sendMessage } from './helpers';

test('Scenario B — AI run, HITL approval notification, discussion, approval, execution and audit', async ({ browser }) => {
  const op = await createUser('e2e_op', 'OPERATOR');
  const rev = await createUser('e2e_rev', 'REVIEWER');
  const o = await loginInNewContext(browser, op);
  const r = await loginInNewContext(browser, rev, { mobile: true });

  // 1. Operator creates a case through the UI (first sample = clearly suspicious invoice).
  await o.page.goto('/operator/cases');
  await o.page.getByTestId('new-case-button').click();
  await o.page.getByTestId('prefill-sample').click();
  await o.page.getByTestId('create-case-submit').click();
  await expect(o.page).toHaveURL(/\/operator\/cases\/\d+/);

  // 2. Launch the agent, assigning the reviewer.
  await o.page.getByTestId('run-analysis-button').click();
  await o.page.getByTestId(`reviewer-option-${rev.username}`).click();
  await o.page.getByTestId('start-run-submit').click();
  await expect(o.page).toHaveURL(/\/operator\/runs\/\d+/);
  const runId = Number(o.page.url().match(/runs\/(\d+)/)![1]);
  await expect(o.page.getByTestId('run-status').first()).toContainText(/awaiting approval/i);

  // 3-4. Reviewer receives the approval request in real time (no reload).
  await expect(r.page.getByTestId('notification-count')).toBeVisible();
  const card = r.page.getByTestId('approval-list').locator('[data-testid^="approval-card-"]').first();
  await expect(card).toBeVisible();

  // 5. Discussion over WebSocket.
  await openConversation(o.page, rev);
  await openConversation(r.page, op);
  const q = `Run #${runId}: facture 5x la moyenne, tu valides ?`;
  await sendMessage(o.page, q);
  await expect(r.page.getByTestId('message-bubble').filter({ hasText: q })).toBeVisible();
  await sendMessage(r.page, 'Vu, je valide.');
  await expect(o.page.getByTestId('message-bubble').filter({ hasText: 'Vu, je valide.' })).toBeVisible();

  // 6. Approve from the mobile reviewer UI.
  await r.page.goto('/reviewer');
  await r.page.getByTestId('approval-list').locator('[data-testid^="approval-card-"]').first().click();
  await r.page.getByTestId('approve-button').click();
  await r.page.getByTestId('decision-reason').fill('Montant anormal confirmé.');
  await r.page.getByTestId('confirm-decision').click();
  await expect(r.page.getByTestId('approval-status').first()).toContainText(/approved/i);

  // 7. Action executed: run completes and case is flagged (verified through REST).
  await o.page.goto(`/operator/runs/${runId}`);
  await expect(o.page.getByTestId('run-status').first()).toContainText(/completed/i);
  const token = await apiToken(op.username);
  const run = await (await o.page.request.get(`/api/agent-runs/${runId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(run.status).toBe('COMPLETED');
  expect(run.approval.status).toBe('APPROVED');
  const kase = await (await o.page.request.get(`/api/cases/${run.caseId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(kase.status).toBe('FLAGGED_FOR_REVIEW');

  // 8. Audit trail.
  const audit = await (await o.page.request.get(`/api/audit-events?agentRunId=${runId}&limit=200`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const types: string[] = audit.items.map((e: { eventType: string }) => e.eventType);
  for (const t of ['run_created', 'approval_requested', 'approval_decided', 'action_executed']) expect(types).toContain(t);
  expect(types.filter((t) => t === 'action_executed')).toHaveLength(1);
  await expect(o.page.getByTestId('audit-event').filter({ hasText: /action.executed/i }).first()).toBeVisible();

  await o.context.close();
  await r.context.close();
});
