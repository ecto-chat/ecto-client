import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash } from 'lucide-react';

import { useServerStore } from '@/stores/server';
import { useUiStore } from '@/stores/ui';
import { EmptyState } from '@/ui/EmptyState';

export function ServerFallback() {
  const activeServerId = useUiStore((s) => s.activeServerId);
  const serverMeta = useServerStore(
    (s) => activeServerId ? s.serverMeta.get(activeServerId) ?? null : null,
  );
  const defaultChannelId = serverMeta?.default_channel_id ?? null;
  const navigate = useNavigate();

  useEffect(() => {
    if (activeServerId && defaultChannelId) {
      useUiStore.getState().setActiveChannel(defaultChannelId);
      navigate(`/servers/${activeServerId}/channels/${defaultChannelId}`, { replace: true });
    }
  }, [activeServerId, defaultChannelId, navigate]);

  if (activeServerId && defaultChannelId) return null;
  return <EmptyState icon={<Hash />} title="Select a channel" />;
}
