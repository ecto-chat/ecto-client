import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Permissions } from 'ecto-shared';
import { useChannels } from '@/hooks/useChannels';
import { usePermissions } from '@/hooks/usePermissions';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { ServerHeader } from '../ServerHeader';
import { SetupBanner } from '../SetupBanner';
import { UserBar } from '../UserBar';
import { ChannelList } from './ChannelList';
import { ServerHub } from './ServerHub';
import type { Channel } from 'ecto-shared';

export function ChannelSidebar() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const { channels, categories, openChannel } = useChannels(
    activeServerId ?? '',
  );
  const [collapsedCategories, setCollapsedCategories] = useState(
    new Set<string>(),
  );
  const navigate = useNavigate();

  const { isAdmin, effectivePermissions } = usePermissions(activeServerId);
  const canReorder =
    isAdmin || (effectivePermissions & Permissions.MANAGE_CHANNELS) !== 0;

  const meta = useServerStore((s) =>
    activeServerId ? s.serverMeta.get(activeServerId) : undefined,
  );
  const showSetupBanner =
    meta &&
    !meta.setup_completed &&
    meta.admin_user_id &&
    meta.user_id === meta.admin_user_id;

  const canViewHub =
    isAdmin || (effectivePermissions & Permissions.VIEW_SERVER_HUB) !== 0;

  const handleChannelClick = useCallback(
    (channel: Channel) => {
      if (channel.type === 'voice') return;
      useUiStore.getState().setActiveChannel(channel.id);
      openChannel(channel.id);
      navigate(`/servers/${activeServerId}/channels/${channel.id}`);
    },
    [activeServerId, openChannel, navigate],
  );

  const handleToggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  const { uncategorized, categorized } = useMemo(() => {
    const uncat: Channel[] = [];
    const catMap = new Map<string, Channel[]>();
    for (const channel of channels) {
      const catId = channel.category_id;
      if (!catId) {
        uncat.push(channel);
      } else {
        const list = catMap.get(catId) ?? [];
        list.push(channel);
        catMap.set(catId, list);
      }
    }
    uncat.sort((a, b) => a.position - b.position);
    for (const list of catMap.values()) list.sort((a, b) => a.position - b.position);
    return { uncategorized: uncat, categorized: catMap };
  }, [channels]);

  return (
    <div className="flex flex-col h-full">
      <ServerHeader />
      {meta?.banner_url && (
        <img
          src={meta.banner_url}
          alt=""
          className="w-full object-cover"
          style={{ maxHeight: 80 }}
        />
      )}
      {showSetupBanner && (
        <SetupBanner
          onClick={() => useUiStore.getState().openModal('setup-wizard')}
        />
      )}
      {canViewHub && <ServerHub />}
      <ChannelList
        uncategorized={uncategorized}
        categories={categories}
        categorized={categorized}
        activeChannelId={activeChannelId}
        collapsedCategories={collapsedCategories}
        onChannelClick={handleChannelClick}
        onToggleCategory={handleToggleCategory}
        canReorder={canReorder}
        serverId={activeServerId ?? ''}
      />
      <UserBar />
    </div>
  );
}
