import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { GraphCanvas } from '@/features/graph/GraphCanvas';

// Mock the elk layout hook so GraphCanvas is the unit under test.
vi.mock('@/features/graph/useElkLayout', () => ({
  useElkLayout: () => ({ status: 'ready', nodes: [], edges: [] }),
}));

// Controlled API hooks
const useGetGraphsQueryMock = vi.fn();
const useGetGraphQueryMock = vi.fn();
vi.mock('@/features/graph/graphApi', () => ({
  useGetGraphsQuery: (...args: unknown[]) => useGetGraphsQueryMock(...args),
  useGetGraphQuery: (...args: unknown[]) => useGetGraphQueryMock(...args),
}));

function renderCanvas() {
  return render(
    <MantineProvider>
      <GraphCanvas />
    </MantineProvider>,
  );
}

afterEach(() => {
  useGetGraphsQueryMock.mockReset();
  useGetGraphQueryMock.mockReset();
});

describe('<GraphCanvas />', () => {
  it('shows loading while the graph list is loading', () => {
    useGetGraphsQueryMock.mockReturnValue({ isLoading: true });
    useGetGraphQueryMock.mockReturnValue({ isLoading: false });
    renderCanvas();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when the list is empty', () => {
    useGetGraphsQueryMock.mockReturnValue({ data: [], isLoading: false });
    useGetGraphQueryMock.mockReturnValue({ isLoading: false });
    renderCanvas();
    expect(screen.getByText(/no graphs/i)).toBeInTheDocument();
  });

  it('requests the first graph id from the list', () => {
    useGetGraphsQueryMock.mockReturnValue({
      data: [
        { id: 'alpha', nodeCount: 1, edgeCount: 0 },
        { id: 'zeta', nodeCount: 2, edgeCount: 1 },
      ],
      isLoading: false,
    });
    useGetGraphQueryMock.mockReturnValue({
      data: { nodes: [], edges: [] },
      isLoading: false,
    });
    renderCanvas();
    expect(useGetGraphQueryMock).toHaveBeenCalledWith('alpha', { skip: false });
  });

  it('shows error state when the graph fetch errors', () => {
    useGetGraphsQueryMock.mockReturnValue({
      data: [{ id: 'alpha', nodeCount: 1, edgeCount: 0 }],
      isLoading: false,
    });
    useGetGraphQueryMock.mockReturnValue({
      isLoading: false,
      error: { status: 500 },
    });
    renderCanvas();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
