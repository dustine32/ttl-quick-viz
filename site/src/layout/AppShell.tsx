import { useEffect, useRef, type ReactNode } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setLeftPanelOpen, setRightPanelOpen } from '@/features/ui';

const HEADER_HEIGHT = 48;
const FOOTER_HEIGHT = 24;

type AppShellProps = {
  header: ReactNode;
  navbar: ReactNode;
  aside: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

export function AppShell({ header, navbar, aside, footer, children }: AppShellProps) {
  const dispatch = useAppDispatch();
  const leftPanelOpen = useAppSelector((s) => s.ui.leftPanelOpen);
  const rightPanelOpen = useAppSelector((s) => s.ui.rightPanelOpen);

  const leftRef = useRef<ImperativePanelHandle>(null);
  const rightRef = useRef<ImperativePanelHandle>(null);
  const prevLeft = useRef(leftPanelOpen);
  const prevRight = useRef(rightPanelOpen);

  useEffect(() => {
    if (prevLeft.current === leftPanelOpen) return;
    prevLeft.current = leftPanelOpen;
    const p = leftRef.current;
    if (!p) return;
    if (leftPanelOpen) p.expand();
    else p.collapse();
  }, [leftPanelOpen]);

  useEffect(() => {
    if (prevRight.current === rightPanelOpen) return;
    prevRight.current = rightPanelOpen;
    const p = rightRef.current;
    if (!p) return;
    if (rightPanelOpen) p.expand();
    else p.collapse();
  }, [rightPanelOpen]);

  return (
    <div className="flex flex-col bg-white" style={{ height: '100dvh' }}>
      <div
        style={{ height: HEADER_HEIGHT }}
        className="shrink-0 border-b border-neutral-200 bg-white"
      >
        {header}
      </div>

      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal" autoSaveId="ttl-viz-layout" className="h-full w-full">
          <Panel
            id="left"
            order={1}
            ref={leftRef}
            collapsible
            collapsedSize={0}
            defaultSize={18}
            minSize={14}
            maxSize={40}
            onCollapse={() => dispatch(setLeftPanelOpen(false))}
            onExpand={() => dispatch(setLeftPanelOpen(true))}
          >
            <div className="h-full overflow-auto border-r border-neutral-200 bg-white">
              {navbar}
            </div>
          </Panel>

          <PanelResizeHandle className="group relative w-[5px] bg-neutral-200 transition-colors data-[resize-handle-state=hover]:bg-blue-400 data-[resize-handle-state=drag]:bg-blue-500" />

          <Panel id="main" order={2} defaultSize={64} minSize={30}>
            <div className="flex h-full flex-col bg-neutral-50">{children}</div>
          </Panel>

          <PanelResizeHandle className="group relative w-[5px] bg-neutral-200 transition-colors data-[resize-handle-state=hover]:bg-blue-400 data-[resize-handle-state=drag]:bg-blue-500" />

          <Panel
            id="right"
            order={3}
            ref={rightRef}
            collapsible
            collapsedSize={0}
            defaultSize={18}
            minSize={14}
            maxSize={40}
            onCollapse={() => dispatch(setRightPanelOpen(false))}
            onExpand={() => dispatch(setRightPanelOpen(true))}
          >
            <div className="h-full overflow-auto border-l border-neutral-200 bg-white">
              {aside}
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <div
        style={{ height: FOOTER_HEIGHT }}
        className="shrink-0 border-t border-neutral-200 bg-white"
      >
        {footer}
      </div>
    </div>
  );
}
