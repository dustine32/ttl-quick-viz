import '@testing-library/jest-dom/vitest';

// Mantine queries color scheme at render time; jsdom lacks matchMedia.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mantine's FloatingIndicator uses ResizeObserver; jsdom lacks it.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
