import { describe, it, expect } from 'vitest';
import {
  MAX_FAVORITES_PER_USER,
  FAVORITES_LIMIT_REACHED,
} from '../listing';

describe('Buyer Favorites Collection Constants (Story 3.5 / FR-20)', () => {
  it('caps a buyer at 100 saved favorites', () => {
    expect(MAX_FAVORITES_PER_USER).toBe(100);
  });

  it('exposes the structured error code the API throws on overflow', () => {
    expect(FAVORITES_LIMIT_REACHED).toBe('FAVORITES_LIMIT_REACHED');
  });
});
