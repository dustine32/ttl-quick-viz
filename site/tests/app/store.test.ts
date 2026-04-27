import { store } from '@/app/store';

describe('store', () => {
  it('is configured and returns an initial state object', () => {
    const state = store.getState();
    expect(typeof state).toBe('object');
    expect(state).not.toBeNull();
  });
});
