import type { ReactNode } from 'react';
import { Button } from '@mantine/core';
import {
  LuArrowRightLeft,
  LuFilter,
  LuLayers,
  LuLayoutDashboard,
  LuMaximize,
  LuPalette,
  LuTags,
  LuTarget,
  LuType,
  LuZap,
} from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { requestFitView, requestRelayout } from '@/features/ui';
import { SectionHeader } from '@/features/inspector/InspectorUI';
import { PredicateFilter } from '@/features/view-config/PredicateFilter';
import { TypeLegend } from '@/features/view-config/TypeLegend';
import { LabelModeToggle } from '@/features/view-config/LabelModeToggle';
import { FocusControls } from '@/features/view-config/FocusControls';
import { StylingControls } from '@/features/view-config/StylingControls';
import { FilterControls } from '@/features/view-config/FilterControls';
import { SwimlaneControls } from '@/features/view-config/SwimlaneControls';
import { selectLayoutAlgoXyflow } from '@/features/view-config/selectors';

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <SectionHeader label={title} icon={icon} />
      <div className="flex flex-col gap-1.5">{children}</div>
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
      <Section title="Quick actions" icon={<LuZap size={11} />}>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            fullWidth
            variant="light"
            color="gray"
            size="xs"
            leftSection={<LuMaximize size={12} />}
            onClick={() => dispatch(requestFitView())}
          >
            Fit view
          </Button>
          <Button
            fullWidth
            variant="light"
            color="gray"
            size="xs"
            leftSection={<LuLayoutDashboard size={12} />}
            onClick={() => dispatch(requestRelayout())}
          >
            Re-run
          </Button>
        </div>
      </Section>

      {showSwimlane ? (
        <Section title="Groups" icon={<LuLayers size={11} />}>
          <SwimlaneControls />
        </Section>
      ) : null}

      <Section title="Filter" icon={<LuFilter size={11} />}>
        <FilterControls />
      </Section>

      <Section title="Predicates" icon={<LuArrowRightLeft size={11} />}>
        <PredicateFilter />
      </Section>

      <Section title="Types" icon={<LuTags size={11} />}>
        <TypeLegend />
      </Section>

      <Section title="Labels" icon={<LuType size={11} />}>
        <LabelModeToggle />
      </Section>

      <Section title="Styling" icon={<LuPalette size={11} />}>
        <StylingControls />
      </Section>

      <Section title="Focus" icon={<LuTarget size={11} />}>
        <FocusControls />
      </Section>
    </div>
  );
}
