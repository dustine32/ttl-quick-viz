import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  const originalError = console.error;

  beforeEach(() => {
    // React logs caught errors to console.error; silence the noise in test output.
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>ok</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
