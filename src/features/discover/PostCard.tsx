import type { DiscoveryPost } from 'ecto-shared';
import { Avatar } from '@/ui/Avatar';
import { useDiscoverStore } from '@/stores/discover';
import { cssUrl } from '@/lib/css-utils';
import { usePostClick } from './usePostClick';

interface PostCardProps {
  post: DiscoveryPost;
  onClick?: () => void;
}

export function PostCard({ post, onClick }: PostCardProps) {
  const liveStats = useDiscoverStore((s) => s.serverStats.get(post.server_id));
  const memberCount = liveStats?.member_count ?? post.server_member_count;
  const onlineCount = liveStats?.online_count ?? post.server_online_count;
  const handlePostClick = usePostClick();

  return (
    <div
      onClick={(e) => {
        if (onClick) { e.stopPropagation(); onClick(); }
        else handlePostClick(post);
      }}
      className="flex gap-3 p-3 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/60 transition-colors cursor-pointer group"
    >
      {post.hero_image_url && (
        <div
          className="w-16 shrink-0 rounded-md bg-cover bg-center self-stretch"
          style={{ backgroundImage: cssUrl(post.hero_image_url) }}
        />
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Avatar src={post.server_icon_url} username={post.server_name} size={16} />
            <span className="text-xs text-white/70 truncate">{post.server_name}</span>
          </div>
          <h3 className="text-sm font-semibold text-white truncate group-hover:underline">{post.title}</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1">
          <span>{memberCount} members</span>
          <span className="flex items-center gap-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
            {onlineCount}
          </span>
        </div>
      </div>
    </div>
  );
}
