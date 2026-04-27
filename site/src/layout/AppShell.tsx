import { useEffect, useRef, type ReactNode } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setBottomPanelOpen,
  setLeftPanelOpen,
  setRightPanelOpen,
} from '@/features/ui';
import { IconRail } from '@/layout/IconRail';

const HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 26;

type AppShellProps = {
  header: ReactNode;
  navbar: ReactNode;
  aside: ReactNode;
  bottom?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

export function AppShell({ header, navbar, aside, bottom, footer, children }: AppShellProps) {
  const dispatch = useAppDispatch();
  const leftPanelOpen = useAppSelector((s) => s.ui.leftPanelOpen);
  const rightPanelOpen = useAppSelector((s) => s.ui.rightPanelOpen);
  const bottomPanelOpen = useAppSelector((s) => s.ui.bottomPanelOpen);

  const leftRef = useRef<ImperativePanelHandle>(null);
  const rightRef = useRef<ImperativePanelHandle>(null);
  const bottomRef = useRef<ImperativePanelHandle>(null);
  const prevLeft = useRef(leftPanelOpen);
  const prevRight = useRef(rightPanelOpen);
  const prevBottom = useRef(bottomPanelOpen);

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

  useEffect(() => {
    if (prevBottom.current === bottomPanelOpen) return;
    prevBottom.current = bottomPanelOpen;
    const p = bottomRef.current;
    if (!p) return;
    if (bottomPanelOpen) p.expand();
    else p.collapse();
  }, [bottomPanelOpen]);

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', background: 'var(--color-shell-bg)' }}
    >
      <div
        style={{
          height: HEADER_HEIGHT,
          background: 'var(--color-panel-bg)',
          borderBottom: '1px solid var(--color-border)',
        }}
        className="shrink-0"
      >
        {header}
      </div>

      <div className="flex-1 min-h-0">
        <PanelGroup direction="vertical" autoSaveId="ttl-viz-vertical" className="h-full w-full">
          <Panel id="upper" order={1} defaultSize={70} minSize={20}>
            <div className="flex h-full">
              <IconRail />
              <div className="flex-1 min-w-0">
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
                    <div
                      className="h-full overflow-auto"
                      style={{
                        background: 'var(--color-panel-bg)',
                        borderRight: '1px solid var(--color-border)',
                      }}
                    >
                      {navbar}
                    </div>
                  </Panel>

                  <PanelResizeHandle
                    className="group relative w-[4px] transition-colors data-[resize-handle-state=hover]:bg-sky-400/40 data-[resize-handle-state=drag]:bg-sky-400/70"
                    style={{ background: 'var(--color-border)' }}
                  />

                  <Panel id="main" order={2} defaultSize={64} minSize={30}>
                    <div
                      className="flex h-full flex-col"
                      style={{ background: 'var(--color-canvas-bg)' }}
                    >
                      {children}
                    </div>
                  </Panel>

                  <PanelResizeHandle
                    className="group relative w-[4px] transition-colors data-[resize-handle-state=hover]:bg-sky-400/40 data-[resize-handle-state=drag]:bg-sky-400/70"
                    style={{ background: 'var(--color-border)' }}
                  />

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
                    <div
                      className="h-full overflow-auto"
                      style={{
                        background: 'var(--color-panel-bg)',
                        borderLeft: '1px solid var(--color-border)',
                      }}
                    >
                      {aside}
                    </div>
                  </Panel>
                </PanelGroup>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle
            className="group relative h-[4px] transition-colors data-[resize-handle-state=hover]:bg-sky-400/40 data-[resize-handle-state=drag]:bg-sky-400/70"
            style={{ background: 'var(--color-border)' }}
          />

          <Panel
            id="bottom"
            order={2}
            ref={bottomRef}
            collapsible
            collapsedSize={0}
            defaultSize={30}
            minSize={12}
            maxSize={70}
            onCollapse={() => dispatch(setBottomPanelOpen(false))}
            onExpand={() => dispatch(setBottomPanelOpen(true))}
          >
            <div
              className="h-full overflow-hidden"
              style={{
                background: 'var(--color-panel-bg)',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              {bottom}
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <div
        style={{
          height: FOOTER_HEIGHT,
          background: 'var(--color-panel-bg)',
          borderTop: '1px solid var(--color-border)',
        }}
        className="shrink-0"
      >
        {footer}
      </div>
    </div>
  );
}
