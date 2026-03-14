import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Permissions } from 'ecto-shared';
import { Modal } from '@/ui';
import { useChannels } from '@/hooks/useChannels';
import { usePermissions } from '@/hooks/usePermissions';
import { useUiStore, useServerStore } from 'ecto-core';
import { CreateChannelForm, CreateCategoryForm } from '@/features/admin/ChannelForm';
import { ServerHeader } from '../ServerHeader';
import { SetupBanner } from '../SetupBanner';
import { UserBar } from '../UserBar';
import { ChannelList } from './ChannelList';
import { ServerHub } from './ServerHub';
import type { Channel, Category } from 'ecto-shared';

export function ChannelSidebar() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const { channels, categories, openChannel } = useChannels(
    activeServerId ?? '',
  );
  const [collapsedCategories, setCollapsedCategories] = useState(
    new Set<string>(),
  );
  // null = closed, string = pre-selected category, undefined = no category pre-selected
  const [createChannelCat, setCreateChannelCat] = useState<string | null | undefined>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
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

  const canManageChannels =
    isAdmin || (effectivePermissions & Permissions.MANAGE_CHANNELS) !== 0;
  const canViewHub =
    isAdmin || (effectivePermissions & Permissions.VIEW_SERVER_HUB) !== 0;

  const handleCreateChannel = useCallback((categoryId?: string) => {
    setCreateChannelCat(categoryId);
  }, []);

  const handleCreateCategory = useCallback(() => {
    setShowCreateCategory(true);
  }, []);

  const categoryList = useMemo<Category[]>(
    () => [...categories.values()],
    [categories],
  );

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
        onCreateChannel={canManageChannels ? handleCreateChannel : undefined}
        onCreateCategory={canManageChannels ? handleCreateCategory : undefined}
      />
      <UserBar />

      {/* Create Channel Modal */}
      <Modal
        open={createChannelCat !== null}
        onOpenChange={(open) => { if (!open) setCreateChannelCat(null); }}
        title="Create Channel"
        width="md"
      >
        {createChannelCat !== null && activeServerId && (
          <CreateChannelForm
            serverId={activeServerId}
            categories={categoryList}
            onDone={() => setCreateChannelCat(null)}
            defaultCategoryId={createChannelCat}
          />
        )}
      </Modal>

      {/* Create Category Modal */}
      <Modal
        open={showCreateCategory}
        onOpenChange={(open) => { if (!open) setShowCreateCategory(false); }}
        title="Create Category"
        width="md"
      >
        {showCreateCategory && activeServerId && (
          <CreateCategoryForm
            serverId={activeServerId}
            onDone={() => setShowCreateCategory(false)}
          />
        )}
      </Modal>
    </div>
  );
}
