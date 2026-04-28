import { ActionIcon, Tooltip } from '@mantine/core';
import { LuGitCompareArrows, LuX } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { clearCompare, openPicker } from '@/features/diff/slices/diffSlice';

export function DiffBadge() {
  const dispatch = useAppDispatch();
  const sha = useAppSelector((s) => s.diff.compareSha);
  const subject = useAppSelector((s) => s.diff.compareSubject);

  if (!sha) return null;

  return (
    <div className="flex flex-nowrap items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1">
      <LuGitCompareArrows size={12} className="text-amber-700" />
      <Tooltip label={subject ?? sha} withArrow>
        <button
          type="button"
          className="max-w-[180px] truncate text-[11px] font-medium text-amber-900"
          onClick={() => dispatch(openPicker())}
        >
          Diff vs <code>{sha.slice(0, 7)}</code>
        </button>
      </Tooltip>
      <Tooltip label="Clear diff" withArrow>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          aria-label="Clear diff"
          onClick={() => dispatch(clearCompare())}
        >
          <LuX size={12} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
