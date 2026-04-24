import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { store } from '@/app/store';

// Mock elkjs so we get a deterministic ready state.
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

// Mock @xyflow/react: the real lib does DOM measurement that jsdom handles badly.
// Keep real enums (Position, MarkerType, BackgroundVariant) via importOriginal;
// only override the components that touch the DOM.
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: ({ children, nodes }: { children: ReactNode; nodes: Array<{ id: string }> }) => (
      <div data-testid="react-flow" data-node-count={nodes.length}>
        {children}
      </div>
    ),
    Background: () => <div data-testid="rf-background" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    Controls: () => <div data-testid="rf-controls" />,
  };
});

import { GraphCanvas } from '@/features/graph/GraphCanvas';

function renderCanvas() {
  return render(
    <Provider store={store}>
      <MantineProvider>
        <GraphCanvas />
      </MantineProvider>
    </Provider>,
  );
}

describe('GraphCanvas', () => {
  it('shows loading, then renders the ReactFlow container once layout is ready', async () => {
    renderCanvas();

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    const rf = screen.getByTestId('react-flow');
    expect(Number(rf.getAttribute('data-node-count'))).toBeGreaterThan(0);
    expect(screen.getByTestId('rf-minimap')).toBeInTheDocument();
    expect(screen.getByTestId('rf-controls')).toBeInTheDocument();
    expect(screen.getByTestId('rf-background')).toBeInTheDocument();
  });
});
