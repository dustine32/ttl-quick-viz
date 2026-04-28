import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GraphCanvas } from '@/features/graph/components/GraphCanvas';
import { diffReducer } from '@/features/diff/slices/diffSlice';
import { graphReducer } from '@/features/graph/slices/graphSlice';
import { uiReducer } from '@/features/ui/uiSlice';
import { viewConfigReducer } from '@/features/view-config/viewConfigSlice';

const STABLE_LAYOUT = { status: 'ready' as const, nodes: [], edges: [] };
vi.mock('@/features/graph/hooks/useElkLayout', () => ({
  useElkLayout: () => STABLE_LAYOUT,
}));

const useGetGraphQueryMock = vi.fn();
vi.mock('@/features/graph/slices/graphApiSlice', () => ({
  useGetGraphQuery: (...args: unknown[]) => useGetGraphQueryMock(...args),
  useGetGraphsQuery: () => ({ data: undefined, isLoading: false }),
}));

function makeStore(selectedGraphId: string) {
  return configureStore({
    reducer: {
      graph: graphReducer,
      ui: uiReducer,
      viewConfig: viewConfigReducer,
      diff: diffReducer,
    },
    preloadedState: {
      graph: { selectedGraphId, renderer: 'xyflow' as const },
    },
  });
}

function renderCanvas(selectedGraphId: string) {
  return render(
    <Provider store={makeStore(selectedGraphId)}>
      <MantineProvider>
        <GraphCanvas />
      </MantineProvider>
    </Provider>,
  );
}

afterEach(() => {
  useGetGraphQueryMock.mockReset();
});

describe('<GraphCanvas />', () => {
  it('shows empty state when no graph is selected', () => {
    useGetGraphQueryMock.mockReturnValue({ isLoading: false });
    renderCanvas('');
    expect(screen.getByText(/select a graph/i)).toBeInTheDocument();
  });

  it('shows loading while the selected graph is loading', () => {
    useGetGraphQueryMock.mockReturnValue({ isLoading: true });
    renderCanvas('alpha');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('requests the selected graph id from Redux', () => {
    useGetGraphQueryMock.mockReturnValue({
      data: { nodes: [], edges: [] },
      isLoading: false,
    });
    renderCanvas('alpha');
    expect(useGetGraphQueryMock).toHaveBeenCalledWith('alpha', { skip: false });
  });

  it('shows error state when the graph fetch errors', () => {
    useGetGraphQueryMock.mockReturnValue({
      isLoading: false,
      error: { status: 500 },
    });
    renderCanvas('alpha');
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
