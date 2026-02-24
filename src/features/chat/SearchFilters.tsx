import { useMemo } from 'react';

import { Select, Switch } from '@/ui';

import { useChannelStore } from '@/stores/channel';
import { useMemberStore } from '@/stores/member';

type SearchFiltersProps = {
  serverId: string;
  filterChannelId: string;
  onChannelChange: (value: string) => void;
  filterAuthorId: string;
  onAuthorChange: (value: string) => void;
  filterHasAttachment: boolean;
  onAttachmentChange: (value: boolean) => void;
};

export function SearchFilters({
  serverId, filterChannelId, onChannelChange,
  filterAuthorId, onAuthorChange,
  filterHasAttachment, onAttachmentChange,
}: SearchFiltersProps) {
  const channelsMap = useChannelStore((s) => s.channels.get(serverId));
  const membersMap = useMemberStore((s) => s.members.get(serverId));

  const channelOptions = useMemo(() => {
    if (!channelsMap) return [];
    return [
      { value: '__all__', label: 'All Channels' },
      ...Array.from(channelsMap.values())
        .filter((c) => c.type === 'text')
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ value: c.id, label: `# ${c.name}` })),
    ];
  }, [channelsMap]);

  const memberOptions = useMemo(() => {
    if (!membersMap) return [];
    return [
      { value: '__all__', label: 'All Authors' },
      ...Array.from(membersMap.values())
        .sort((a, b) => (a.display_name ?? a.username).localeCompare(b.display_name ?? b.username))
        .map((m) => ({ value: m.user_id, label: m.display_name ?? m.username })),
    ];
  }, [membersMap]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b-2 border-primary px-3 py-2">
      <Select
        options={channelOptions}
        value={filterChannelId || '__all__'}
        onValueChange={(v) => onChannelChange(v === '__all__' ? '' : v)}
        placeholder="All Channels"
        className="w-40"
      />
      <Select
        options={memberOptions}
        value={filterAuthorId || '__all__'}
        onValueChange={(v) => onAuthorChange(v === '__all__' ? '' : v)}
        placeholder="All Authors"
        className="w-40"
      />
      <Switch
        label="Has attachment"
        checked={filterHasAttachment}
        onCheckedChange={onAttachmentChange}
        className="ml-1"
      />
    </div>
  );
}
