/**
 * Deal binding behaviour shared by the API and the web (Story 5.1 / FR-29, BR-02).
 *
 * Same folder shape as `masking/`: one barrel, one implementation per concern, its own
 * `__tests__/`. Three conventions are deliberate:
 *
 * - money is fixed-point bigint arithmetic (`money.ts`) — `Number()` on a price is a BR-02 defect;
 * - identifiers are derived from the UUID by the service that inserts the row (`identity.ts`);
 * - Story 5.2 adds the buyer's payment plan: `countdown.ts` (the 48-hour timer, server-clocked)
 *   and `payment.ts` (slot legality and the receipt guardrails), both pure.
 */
export * from './money';
export * from './identity';
export * from './countdown';
export * from './payment';
export * from './invoice';
