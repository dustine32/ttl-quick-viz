import { useAppSelector } from '@/app/hooks';
import { GraphCanvas } from '@/features/graph';
import { CytoscapeCanvas } from '@/features/graph-cytoscape';
import { ForceCanvas, ForceCanvas3D } from '@/features/graph-force';
import { SigmaCanvas } from '@/features/graph-sigma';
import { GraphinCanvas } from '@/features/graph-graphin';
import { CommandPalette } from '@/features/search';
import { useUrlSync } from '@/features/url-state';
import {
  AppShell,
  LeftPanel,
  RightPanel,
  StatusBar,
  Toolbar,
  useAppHotkeys,
} from '@/layout';

export default function App() {
  const renderer = useAppSelector((s) => s.graph.renderer);
  useAppHotkeys();
  useUrlSync();

  return (
    <>
      <AppShell
        header={<Toolbar />}
        navbar={<LeftPanel />}
        aside={<RightPanel />}
        footer={<StatusBar />}
      >
        <div className="flex-1 min-h-0 bg-neutral-50">
          {renderer === 'xyflow' && <GraphCanvas />}
          {renderer === 'cytoscape' && <CytoscapeCanvas />}
          {renderer === 'force' && <ForceCanvas />}
          {renderer === 'force3d' && <ForceCanvas3D />}
          {renderer === 'sigma' && <SigmaCanvas />}
          {renderer === 'graphin' && <GraphinCanvas />}
        </div>
      </AppShell>
      <CommandPalette />
    </>
  );
}
