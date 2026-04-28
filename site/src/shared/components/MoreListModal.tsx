import { Modal, TextInput } from '@mantine/core';
import { useEffect, useState, type ReactNode } from 'react';
import { LuSearch } from 'react-icons/lu';

type Props = {
  opened: boolean;
  onClose: () => void;
  title: string;
  total: number;
  placeholder?: string;
  renderItems: (query: string) => ReactNode;
};

export function MoreListModal({
  opened,
  onClose,
  title,
  total,
  placeholder = 'Filter…',
  renderItems,
}: Props) {
  const [query, setQuery] = useState('');

  // Clear the filter when the modal closes so re-opening starts fresh.
  useEffect(() => {
    if (!opened) setQuery('');
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <span className="text-sm font-semibold text-slate-900">
          {title}{' '}
          <span className="font-normal tabular-nums text-slate-500">({total})</span>
        </span>
      }
      size="lg"
      centered
    >
      <TextInput
        placeholder={placeholder}
        size="xs"
        leftSection={<LuSearch size={12} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        autoFocus
        mb="xs"
      />
      <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto pr-1">
        {renderItems(query.trim().toLowerCase())}
      </div>
    </Modal>
  );
}
