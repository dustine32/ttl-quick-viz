import { useEffect, useRef } from 'react';
import { createSelector } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setRenderer, setSelectedGraphId } from '@/features/graph';
import {
  setFocusDepth,
  setFocusNodeId,
  setHiddenPredicates,
  setHiddenTypes,
  setLabelMode,
  setLayoutAlgo,
  setSizeByDegree,
} from '@/features/view-config';
import type { RootState } from '@/app/store';
import { fromStore, parse, serialize } from '@/features/url-state/urlState';

const selectUrlHash = createSelector(
  (s: RootState) => s.graph,
  (s: RootState) => s.viewConfig,
  (graph, viewConfig) =>
    serialize(fromStore({ graph, viewConfig } as RootState)),
);

export function useUrlSync() {
  const dispatch = useAppDispatch();
  const hydratedRef = useRef(false);

  const serialized = useAppSelector(selectUrlHash);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const parsed = parse(window.location.hash);
    if (!parsed) return;

    if (parsed.g !== undefined) dispatch(setSelectedGraphId(parsed.g));
    if (parsed.r) dispatch(setRenderer(parsed.r));
    if (parsed.lm) dispatch(setLabelMode(parsed.lm));
    if (parsed.la) dispatch(setLayoutAlgo({ renderer: 'xyflow', algo: parsed.la }));
    if (parsed.lc) dispatch(setLayoutAlgo({ renderer: 'cytoscape', algo: parsed.lc }));
    if (parsed.hp) dispatch(setHiddenPredicates(parsed.hp));
    if (parsed.ht) dispatch(setHiddenTypes(parsed.ht));
    if (parsed.fid !== undefined) dispatch(setFocusNodeId(parsed.fid));
    if (parsed.fd !== undefined) dispatch(setFocusDepth(parsed.fd));
    if (parsed.sbd !== undefined) dispatch(setSizeByDegree(parsed.sbd));
  }, [dispatch]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const hash = `#${serialized}`;
    if (hash !== window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${hash}`,
      );
    }
  }, [serialized]);
}
