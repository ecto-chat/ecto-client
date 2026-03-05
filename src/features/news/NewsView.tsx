import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { Permissions } from 'ecto-shared';
import type { NewsPost } from 'ecto-shared';

import { useChannelStore } from '@/stores/channel';
import { useAuthStore } from '@/stores/auth';
import { useMemberStore } from '@/stores/member';
import { usePermissions } from '@/hooks/usePermissions';
import { connectionManager } from '@/services/connection-manager';

import { NewsPostList } from './NewsPostList';
import { NewsPostDetail } from './NewsPostDetail';
import { NewsPostForm } from './NewsPostForm';

interface NewsViewProps {
  serverId: string;
  channelId: string;
}

export function NewsView({ serverId, channelId }: NewsViewProps) {
  const channel = useChannelStore((s) => s.channels.get(serverId)?.get(channelId));
  const { isAdmin, effectivePermissions } = usePermissions(serverId);
  const canManageNews = isAdmin || (effectivePermissions & Permissions.MANAGE_NEWS) !== 0;
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentMember = useMemberStore((s) => currentUserId ? s.members.get(serverId)?.get(currentUserId) : undefined);
  const isGlobalUser = currentMember?.identity_type === 'global';
  const [discoverable, setDiscoverable] = useState(false);
  const [discoveryApproved, setDiscoveryApproved] = useState(false);

  useEffect(() => {
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.serverConfig.get.query().then((cfg) => {
      setDiscoverable(cfg.discoverable ?? false);
      setDiscoveryApproved(cfg.discovery_approved ?? false);
    }).catch(() => {});
  }, [serverId]);

  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);

  // Deep-link: auto-open a post from ?post=<id> (e.g. from discover page)
  useEffect(() => {
    const postId = searchParams.get('post');
    if (!postId || selectedPost) return;
    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;
    trpc.news.getPost.query({ post_id: postId }).then((post) => {
      setSelectedPost(post);
      setSearchParams({}, { replace: true });
    }).catch(() => {
      setSearchParams({}, { replace: true });
    });
  }, [serverId, searchParams, selectedPost, setSearchParams]);

  if (showForm || editingPost) {
    return (
      <NewsPostForm
        serverId={serverId}
        channelId={channelId}
        post={editingPost ?? undefined}
        discoverable={discoverable && isGlobalUser}
        discoveryApproved={discoveryApproved}
        onDone={() => {
          setShowForm(false);
          setEditingPost(null);
        }}
      />
    );
  }

  if (selectedPost) {
    return (
      <NewsPostDetail
        serverId={serverId}
        channelId={channelId}
        post={selectedPost}
        canManage={canManageNews}
        onBack={() => setSelectedPost(null)}
        onEdit={(post) => setEditingPost(post)}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Channel header */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b-2 border-primary px-4">
        <Newspaper size={18} className="text-muted" />
        <span className="text-sm text-primary">{channel?.name ?? 'News'}</span>
        {channel?.topic && (
          <>
            <div className="mx-2 h-4 w-px bg-border" />
            <span className="truncate text-xs text-muted">{channel.topic}</span>
          </>
        )}
        {canManageNews && (
          <button
            className="ml-auto px-3 py-1.5 text-xs font-semibold bg-accent text-white rounded hover:bg-accent/80 transition-colors"
            onClick={() => setShowForm(true)}
          >
            New Post
          </button>
        )}
      </div>

      <NewsPostList
        serverId={serverId}
        channelId={channelId}
        canManage={canManageNews}
        onSelect={setSelectedPost}
        onEdit={setEditingPost}
      />
    </div>
  );
}
