import { usePresenceStore } from '../stores/presence.js';
import type { PresenceStatus } from 'ecto-shared';

export function usePresence(userId: string) {
  const presence = usePresenceStore((s) => s.presences.get(userId));

  return {
    status: (presence?.status ?? 'offline') as PresenceStatus,
    customText: presence?.custom_text,
    isOnline: presence?.status === 'online' || presence?.status === 'idle' || presence?.status === 'dnd',
  };
}
