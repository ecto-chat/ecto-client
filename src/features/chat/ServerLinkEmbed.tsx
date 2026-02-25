import { useState, useEffect } from 'react';

import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';

import { Avatar, Button } from '@/ui';
import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';
import { connectionManager } from '@/services/connection-manager';

import { extractServerAddresses } from '@/lib/server-address';
import { fetchServerPreview } from '@/features/servers/server-join-utils';
import type { ServerPreviewData } from '@/features/servers/types';

type ServerEmbed = {
  address: string;
  preview: ServerPreviewData;
};

type ServerEmbedCardProps = {
  embed: ServerEmbed;
  onNavigate: (serverId: string) => void;
};

function ServerEmbedCard({ embed, onNavigate }: ServerEmbedCardProps) {
  const { address, preview } = embed;

  // Check if user already joined this server (by matching server_address)
  const joinedServerId = useServerStore((s) => {
    for (const [id, server] of s.servers) {
      if (server.server_address === address) return id;
    }
    return null;
  });

  const handleClick = () => {
    if (joinedServerId) {
      onNavigate(joinedServerId);
    } else {
      useUiStore.getState().openModal('add-server', { initialAddress: address });
    }
  };

  const isInviteOnly = !joinedServerId && preview.require_invite;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-2 flex flex-col gap-2.5 rounded-md border border-border bg-tertiary p-3 max-w-[400px]"
    >
      <div className="flex items-center gap-3">
        <Avatar src={preview.icon_url} username={preview.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">{preview.name}</p>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              {preview.online_count} Online
            </span>
            <span>{preview.member_count} Members</span>
          </div>
        </div>
      </div>

      <Button
        size="sm"
        variant={isInviteOnly ? 'secondary' : 'primary'}
        className="w-full"
        onClick={handleClick}
      >
        {isInviteOnly ? (
          <>
            <Lock size={14} />
            Invite Only
          </>
        ) : (
          <>
            Go to Server
            <ArrowRight size={14} />
          </>
        )}
      </Button>
    </motion.div>
  );
}

type ServerLinkEmbedsProps = {
  content: string;
};

export function ServerLinkEmbeds({ content }: ServerLinkEmbedsProps) {
  const [embeds, setEmbeds] = useState<ServerEmbed[]>([]);
  const navigate = useNavigate();

  const handleNavigate = (serverId: string) => {
    useUiStore.getState().setActiveServer(serverId);
    const meta = useServerStore.getState().serverMeta.get(serverId);
    const defaultChannelId = meta?.default_channel_id;
    if (defaultChannelId) {
      useUiStore.getState().setActiveChannel(defaultChannelId);
      navigate(`/servers/${serverId}/channels/${defaultChannelId}`);
    } else {
      useUiStore.getState().setActiveChannel(null);
      navigate(`/servers/${serverId}/channels`);
    }
    connectionManager.switchServer(serverId).catch(() => {});
  };

  useEffect(() => {
    const addresses = extractServerAddresses(content);
    if (addresses.length === 0) {
      setEmbeds([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      addresses.map(async (address) => {
        try {
          const preview = await fetchServerPreview(address);
          return { address, preview } as ServerEmbed;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setEmbeds(results.filter((r): r is ServerEmbed => r !== null));
    });

    return () => { cancelled = true; };
  }, [content]);

  if (embeds.length === 0) return null;

  return (
    <AnimatePresence>
      {embeds.map((embed) => (
        <ServerEmbedCard key={embed.address} embed={embed} onNavigate={handleNavigate} />
      ))}
    </AnimatePresence>
  );
}
