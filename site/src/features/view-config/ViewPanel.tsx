import type { ReactNode } from 'react';
import { Button, Stack } from '@mantine/core';
import { useAppDispatch } from '@/app/hooks';
import { requestFitView, requestRelayout } from '@/features/ui';
import { IconFitView, IconLayout } from '@/layout/icons';
import { PredicateFilter } from '@/features/view-config/PredicateFilter';
import { TypeLegend } from '@/features/view-config/TypeLegend';
import { LabelModeToggle } from '@/features/view-config/LabelModeToggle';
import { FocusControls } from '@/features/view-config/FocusControls';
import { StylingControls } from '@/features/view-config/StylingControls';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <div className="text-xs font-semibold uppercase text-neutral-500 tracking-[0.4px]">
        {title}
      </div>
      {children}
    </Stack>
  );
}

export function ViewPanel() {
  const dispatch = useAppDispatch();

  return (
    <Stack gap="md">
      <Section title="Camera">
        <Button
          variant="light"
          color="gray"
          size="xs"
          leftSection={<IconFitView />}
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
          leftSection={<IconLayout />}
          onClick={() => dispatch(requestRelayout())}
        >
          Re-run layout
        </Button>
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
    </Stack>
  );
}
