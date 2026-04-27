import type { ReactNode } from 'react';
import { Button } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { requestFitView, requestRelayout } from '@/features/ui';
import { LuLayoutDashboard, LuMaximize } from 'react-icons/lu';
import { PredicateFilter } from '@/features/view-config/PredicateFilter';
import { TypeLegend } from '@/features/view-config/TypeLegend';
import { LabelModeToggle } from '@/features/view-config/LabelModeToggle';
import { FocusControls } from '@/features/view-config/FocusControls';
import { StylingControls } from '@/features/view-config/StylingControls';
import { FilterControls } from '@/features/view-config/FilterControls';
import { SwimlaneControls } from '@/features/view-config/SwimlaneControls';
import { selectLayoutAlgoXyflow } from '@/features/view-config/selectors';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold uppercase tracking-[0.4px] text-neutral-500">
        {title}
      </div>
      {children}
    </div>
  );
}

export function ViewPanel() {
  const dispatch = useAppDispatch();
  const renderer = useAppSelector((s) => s.graph.renderer);
  const xyflowAlgo = useAppSelector(selectLayoutAlgoXyflow);
  const showSwimlane = renderer === 'xyflow' && xyflowAlgo === 'swimlane';

  return (
    <div className="flex flex-col gap-4">
      <Section title="Camera">
        <Button
          variant="light"
          color="gray"
          size="xs"
          leftSection={<LuMaximize />}
          onClick={() => dispatch(requestFitView())}
        >
          Fit view
        </Button>
      </Section>

      <Section title="Layout">
        <Button
          variant="light"
          color="gray"
          size="xs"
          leftSection={<LuLayoutDashboard />}
          onClick={() => dispatch(requestRelayout())}
        >
          Re-run layout
        </Button>
      </Section>

      {showSwimlane ? (
        <Section title="Groups">
          <SwimlaneControls />
        </Section>
      ) : null}

      <Section title="Filter">
        <FilterControls />
      </Section>

      <Section title="Predicates">
        <PredicateFilter />
      </Section>

      <Section title="Types">
        <TypeLegend />
      </Section>

      <Section title="Labels">
        <LabelModeToggle />
      </Section>

      <Section title="Styling">
        <StylingControls />
      </Section>

      <Section title="Focus">
        <FocusControls />
      </Section>
    </div>
  );
}
