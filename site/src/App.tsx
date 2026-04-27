import { useAppSelector } from '@/app/hooks';
import { GraphCanvas, StandaloneList } from '@/features/graph';
import { CytoscapeCanvas } from '@/features/graph-cytoscape';
import { ForceCanvas, ForceCanvas3D } from '@/features/graph-force';
import { SigmaCanvas } from '@/features/graph-sigma';
import { GraphinCanvas } from '@/features/graph-graphin';
import { TreeCanvas } from '@/features/graph-tree';
import { TtlPane } from '@/features/ttl-source';
import { useUrlSync } from '@/features/url-state';
import { selectStandaloneMode } from '@/features/view-config';
import {
  AppShell,
  CanvasHeader,
  LeftPanel,
  RightPanel,
  StatusBar,
  Toolbar,
  useAppHotkeys,
} from '@/layout';

export default function App() {
  const renderer = useAppSelector((s) => s.graph.renderer);
  const standaloneMode = useAppSelector(selectStandaloneMode);
  useAppHotkeys();
  useUrlSync();

  const showOrphansOnly = standaloneMode === 'only';

  return (
    <AppShell
      header={<Toolbar />}
      navbar={<LeftPanel />}
      aside={<RightPanel />}
      bottom={<TtlPane />}
      footer={<StatusBar />}
    >
      <CanvasHeader />
      <div className="flex-1 min-h-0">
        {showOrphansOnly ? (
          <StandaloneList />
        ) : (
          <>
            {renderer === 'xyflow' && <GraphCanvas />}
            {renderer === 'cytoscape' && <CytoscapeCanvas />}
            {renderer === 'force' && <ForceCanvas />}
            {renderer === 'force3d' && <ForceCanvas3D />}
            {renderer === 'sigma' && <SigmaCanvas />}
            {renderer === 'graphin' && <GraphinCanvas />}
            {renderer === 'tree' && <TreeCanvas />}
          </>
        )}
      </div>
    </AppShell>
  );
}
