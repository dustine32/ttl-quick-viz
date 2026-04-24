import { GraphCanvas } from '@/features/graph';

export default function App() {
  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <header className="flex items-center border-b border-neutral-200 px-4 py-2">
        <h1 className="text-sm font-medium text-neutral-700">TTL Quick Viz</h1>
      </header>
      <main className="flex-1 min-h-0">
        <GraphCanvas />
      </main>
    </div>
  );
}
