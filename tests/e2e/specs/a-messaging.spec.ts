import { expect, test } from '@playwright/test';
import { createUser, login, loginInNewContext, openConversation, sendMessage } from './helpers';

test('Scenario A — real-time messaging between two clients, presence and history after reconnect', async ({ browser }) => {
  const alice = await createUser('e2e_op', 'OPERATOR');
  const bob = await createUser('e2e_rev', 'REVIEWER');

  // Two isolated contexts = two distinct clients (desktop + mobile viewport).
  const a = await loginInNewContext(browser, alice);
  const b = await loginInNewContext(browser, bob, { mobile: true });

  await openConversation(a.page, bob);
  await openConversation(b.page, alice);

  // Presence: Bob sees Alice online in his contact list (desktop list for Alice).
  await a.page.goto('/messages');
  await expect(a.page.getByTestId(`contact-${bob.username}`)).toContainText('Online');
  await openConversation(a.page, bob);

  // A → B, delivered without refresh.
  const m1 = `Bonjour Bob ${Date.now()}`;
  await sendMessage(a.page, m1);
  await expect(b.page.getByTestId('message-bubble').filter({ hasText: m1 })).toBeVisible();

  // B → A.
  const m2 = `Salut Alice ${Date.now()}`;
  await sendMessage(b.page, m2);
  await expect(a.page.getByTestId('message-bubble').filter({ hasText: m2 })).toBeVisible();

  // Disconnect A completely (close the device), Bob sees her offline.
  await a.context.close();
  await b.page.goto('/messages');
  await expect(b.page.getByTestId(`contact-${alice.username}`)).toContainText('Offline');

  // While A is offline, B sends a message: it must be persisted and recovered.
  await openConversation(b.page, alice);
  const m3 = `Message pendant ta déconnexion ${Date.now()}`;
  await sendMessage(b.page, m3);
  await expect(b.page.getByTestId('message-bubble').filter({ hasText: m3 })).toBeVisible();

  // A reconnects on a brand new client: history comes from REST.
  const a2 = await loginInNewContext(browser, alice);
  await openConversation(a2.page, bob);
  for (const text of [m1, m2, m3]) {
    await expect(a2.page.getByTestId('message-bubble').filter({ hasText: text })).toBeVisible();
  }

  await a2.context.close();
  await b.context.close();
});
