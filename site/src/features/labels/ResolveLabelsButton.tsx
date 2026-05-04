import { ActionIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import { LuTags } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import { iriToCurie } from '@/features/labels/iriToCurie';
import { addResolvedLabels } from '@/features/labels/labelsSlice';
import { resolveLabels } from '@/features/labels/golrClient';
import { selectLabelsByIri } from '@/features/labels/selectors';

const SKIP_PREFIXES = new Set(['gomodel']);

function isResolvableIri(iri: string, byIri: Record<string, string>): boolean {
  if (!iri || byIri[iri]) return false;
  const curie = iriToCurie(iri);
  if (!curie) return false;
  const prefix = curie.slice(0, curie.indexOf(':'));
  return !SKIP_PREFIXES.has(prefix);
}

function collectTypeIris(attrs: Record<string, unknown> | undefined): string[] {
  const t = attrs?.['rdf:type'];
  if (!Array.isArray(t)) return [];
  return t.filter((v): v is string => typeof v === 'string');
}

export function ResolveLabelsButton() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const byIri = useAppSelector(selectLabelsByIri);
  const { data: graph } = useGetGraphQuery(selectedGraphId, { skip: !selectedGraphId });
  const [running, setRunning] = useState(false);

  // Collect every IRI in the current graph that GOlr could resolve and
  // that we don't already have a label for. Includes:
  //   - node IDs without a wire label (the node *is* a class/instance IRI)
  //   - rdf:type IRIs on every node (these are usually GO/CL/etc. classes)
  //   - edge predicates (relations not covered by the bundled cache)
  const pending = useMemo<string[]>(() => {
    if (!graph) return [];
    const set = new Set<string>();
    for (const node of graph.nodes) {
      if (!node.label && isResolvableIri(node.id, byIri)) set.add(node.id);
      for (const typeIri of collectTypeIris(node.attrs)) {
        if (isResolvableIri(typeIri, byIri)) set.add(typeIri);
      }
    }
    for (const edge of graph.edges) {
      if (edge.label && isResolvableIri(edge.label, byIri)) set.add(edge.label);
    }
    return Array.from(set);
  }, [graph, byIri]);

  const handleClick = async () => {
    if (pending.length === 0 || running) return;
    setRunning(true);
    try {
      const result = await resolveLabels(pending);
      if (result.resolvedCount > 0) {
        dispatch(addResolvedLabels(result.byIri));
      }
      if (result.failedChunks === result.totalChunks && result.totalChunks > 0) {
        notifications.show({
          color: 'red',
          title: 'Label resolution failed',
          message:
            'All ' +
            String(result.totalChunks) +
            ' GOlr requests failed. ' +
            (result.lastError ?? 'See console for details.'),
          autoClose: 8000,
        });
      } else if (result.failedChunks > 0) {
        notifications.show({
          color: 'yellow',
          title: 'Partial resolution',
          message:
            'Resolved ' +
            String(result.resolvedCount) +
            ' of ' +
            String(result.requestedCount) +
            '; ' +
            String(result.failedChunks) +
            ' of ' +
            String(result.totalChunks) +
            ' chunks failed.',
          autoClose: 6000,
        });
      } else {
        notifications.show({
          color: result.resolvedCount > 0 ? 'teal' : 'gray',
          title: 'Labels resolved',
          message:
            'Resolved ' +
            String(result.resolvedCount) +
            ' of ' +
            String(result.requestedCount) +
            ' from GOlr',
          autoClose: 3500,
        });
      }
    } catch (err) {
      console.error('[labels] resolveLabels threw:', err);
      notifications.show({
        color: 'red',
        title: 'Label resolution failed',
        message: err instanceof Error ? err.message : 'Could not reach GOlr',
        autoClose: 6000,
      });
    } finally {
      setRunning(false);
    }
  };

  const tooltip =
    pending.length === 0
      ? 'All labels resolved'
      : 'Resolve ' + String(pending.length) + ' labels via GOlr';

  return (
    <Tooltip label={tooltip} withArrow openDelay={300}>
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={tooltip}
        onClick={handleClick}
        loading={running}
        disabled={pending.length === 0}
      >
        <LuTags size={16} />
      </ActionIcon>
    </Tooltip>
  );
}
