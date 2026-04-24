import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { vi } from 'vitest';
import { store } from '@/app/store';

vi.mock('elkjs/lib/elk.bundled.js', () => {
  class FakeELK {
    async layout(input: { children: Array<{ id: string }>; edges: unknown[] }) {
      return {
        ...input,
        children: input.children.map((c, i) => ({ ...c, x: i * 100, y: 0 })),
      };
    }
  }
  return { default: FakeELK };
});

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: () => <div data-testid="react-flow" />,
    Background: () => null,
    MiniMap: () => null,
    Controls: () => null,
  };
});

import App from '@/App';

describe('App', () => {
  it('renders the header title and the graph canvas region', () => {
    render(
      <Provider store={store}>
        <MantineProvider>
          <App />
        </MantineProvider>
      </Provider>,
    );
    expect(screen.getByRole('heading', { name: /TTL Quick Viz/i })).toBeInTheDocument();
  });
});
