import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookingDetail } from '../src/civitatis/parser/parse-booking-detail.js';
import { ReservationScreenshotService } from '../src/civitatis/parser/reservation-screenshot-service.js';
ReservationScreenshotService.prototype.save = async () => 'test.png';

function fixture({ clientFailure = false, phoneFailure = false, agency = false } = {}) {
  const calls = [];
  let finds = 0;
  const reservation = {
    $eval: async () => 'Reservation details',
    $$eval: async () => ({ Language: 'Italian', Date: 'September 13, 2026' }),
  };
  const client = {
    $eval: async selector => selector.includes('header') ? 'Client details' : 'Test Customer',
    $: async () => ({ click: async () => calls.push('open-client') }),
    evaluate: async () => false,
    waitForSelector: async selector => {
      calls.push(selector);
      if (clientFailure) throw new Error('client timeout');
    },
    $$: async () => agency ? [{ evaluate: async () => true, click: async () => calls.push('reveal-agency') }] : [],
  };
  const page = {
    $$: async selector => {
      if (selector.includes('popupbox')) return [{ evaluate: async () => true, click: async () => calls.push('dismiss-popup') }];
      finds++;
      if (phoneFailure && finds === 3) throw new Error('phone timeout');
      return [reservation, client];
    },
    waitForFunction: async () => calls.push('wait-popup'),
  };
  return { page, calls };
}

test('popup is dismissed before client access; client failure preserves reservation', async () => {
  const { page, calls } = fixture({ clientFailure: true });
  const result = await parseBookingDetail(page, 'test');
  assert.equal(result.reservation.Language, 'Italian');
  assert.equal(result.reservation.Date, 'September 13, 2026');
  assert.equal(result.client.phone, null);
  assert.equal(result.warnings[0].stage, 'client-details');
  assert.deepEqual(calls.slice(0, 3), ['dismiss-popup', 'wait-popup', 'open-client']);
});

test('agency reveal is followed by a visibility wait; phone failure preserves name', async () => {
  const { page, calls } = fixture({ agency: true, phoneFailure: true });
  const result = await parseBookingDetail(page, 'test');
  assert.equal(result.client.name, 'Test Customer');
  assert.equal(result.reservation.Language, 'Italian');
  assert.equal(result.warnings[0].stage, 'client-phone');
  assert.deepEqual(calls.slice(-2), ['reveal-agency', '.m-client-data-list']);
});
