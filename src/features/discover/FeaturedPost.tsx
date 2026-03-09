import type { DiscoveryPost } from 'ecto-shared';
import { Users } from 'lucide-react';
import { Avatar } from '@/ui/Avatar';
import { useDiscoverStore, useUiStore } from 'ecto-core';
import { cssUrl } from '@/lib/css-utils';
import { usePostClick } from './usePostClick';

interface FeaturedPostProps {
  post: DiscoveryPost;
}

export function FeaturedPost({ post }: FeaturedPostProps) {
  const liveStats = useDiscoverStore((s) => s.serverStats.get(post.server_id));
  const memberCount = liveStats?.member_count ?? post.server_member_count;
  const onlineCount = liveStats?.online_count ?? post.server_online_count;
  const handleClick = usePostClick();

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.author_id) {
      useUiStore.getState().openModal('user-profile', { userId: post.author_id });
    }
  };

  return (
    <div
      onClick={() => handleClick(post)}
      className="relative rounded-lg overflow-hidden min-h-[410px] cursor-pointer group"
      style={{
        backgroundImage: post.hero_image_url ? cssUrl(post.hero_image_url) : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: post.hero_image_url ? undefined : 'var(--color-tertiary)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />

      {/* Server info card — top left */}
      <div className="absolute top-4 left-4 flex items-center gap-2.5 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-2">
        <Avatar src={post.server_icon_url} username={post.server_name} size={28} />
        <div className="flex flex-col">
          <span className="text-sm text-white font-semibold leading-tight">{post.server_name}</span>
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span className="flex items-center gap-1">
              <Users size={10} />
              {memberCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
              {onlineCount}
            </span>
          </div>
        </div>
      </div>

      {/* Post content card — bottom left, 50% width, 40% height */}
      <div className="absolute bottom-4 left-4 w-[50%] h-[40%] flex flex-col justify-between rounded-lg bg-black/60 backdrop-blur-sm p-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white mb-1 group-hover:underline line-clamp-2">{post.title}</h2>
          {post.subtitle && (
            <p className="text-sm text-white/70 line-clamp-2">{post.subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAuthorClick}
          className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors w-fit"
        >
          <Avatar src={post.author_avatar_url} username={post.author_name} size={18} />
          <span>{post.author_name}</span>
        </button>
      </div>
    </div>
  );
}
