import {
  Alert,
  Loader,
  Modal,
  ScrollArea,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { LuGitCommitHorizontal, LuTriangleAlert } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphHistoryQuery, useGetGraphQuery } from '@/features/graph';
import { closePicker, setCompare } from '@/features/diff/slices/diffSlice';

const HISTORY_N = 5;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export function DiffPicker() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.diff.pickerOpen);
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);

  const { data: currentGraph } = useGetGraphQuery(graphId, {
    skip: !graphId,
  });
  const {
    data: history,
    error,
    isFetching,
  } = useGetGraphHistoryQuery(
    { id: graphId, n: HISTORY_N },
    { skip: !open || !graphId },
  );

  const close = () => dispatch(closePicker());

  const status =
    error && typeof error === 'object' && 'status' in error
      ? (error as { status: number | string }).status
      : null;

  return (
    <Modal
      opened={open}
      onClose={close}
      title={`Compare against history${graphId ? ` — ${graphId}` : ''}`}
      size="lg"
      centered
    >
      {!graphId && (
        <Text size="sm" c="dimmed">
          Select a graph first.
        </Text>
      )}

      {isFetching && (
        <div className="flex items-center justify-center py-8">
          <Loader size="sm" />
        </div>
      )}

      {error != null && status === 503 && (
        <Alert
          icon={<LuTriangleAlert size={16} />}
          color="yellow"
          variant="light"
          title="History unavailable"
        >
          Set <code>MODELS_GIT_REPO</code> on the api to point at the git
          repository whose <code>models/&lt;id&gt;.ttl</code> files hold the
          historical converter outputs.
        </Alert>
      )}

      {error != null && status === 404 && (
        <Alert color="gray" variant="light" title="No history">
          This graph has no committed history in the configured repo.
        </Alert>
      )}

      {error != null && status !== 503 && status !== 404 && (
        <Alert color="red" variant="light" title="History fetch failed">
          {String(status ?? 'unknown error')}
        </Alert>
      )}

      {history && history.length > 0 && currentGraph && (
        <ScrollArea.Autosize mah={420} type="hover">
          <div className="flex flex-col gap-1">
            {history.map((entry) => (
              <UnstyledButton
                key={entry.sha}
                onClick={() =>
                  dispatch(
                    setCompare({
                      sha: entry.sha,
                      subject: entry.subject,
                      compareGraph: entry.graph,
                      currentGraph,
                    }),
                  )
                }
                className="rounded-md border border-neutral-200 px-3 py-2 text-left transition-colors hover:bg-blue-50"
              >
                <div className="flex items-start gap-2">
                  <LuGitCommitHorizontal
                    size={14}
                    className="mt-0.5 shrink-0 text-neutral-500"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {entry.subject}
                    </span>
                    <span className="text-xs text-neutral-500">
                      <code>{entry.sha.slice(0, 7)}</code> · {fmtDate(entry.date)} ·{' '}
                      {entry.graph.nodes.length}n / {entry.graph.edges.length}e
                    </span>
                  </div>
                </div>
              </UnstyledButton>
            ))}
          </div>
        </ScrollArea.Autosize>
      )}
    </Modal>
  );
}
