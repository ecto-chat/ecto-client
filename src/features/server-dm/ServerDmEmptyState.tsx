import { MessageCircle } from 'lucide-react';
import { EmptyState } from '@/ui';

export function ServerDmEmptyState() {
  return (
    <EmptyState
      icon={<MessageCircle />}
      title="No private messages yet"
      description="Right-click a member or use their profile to start a conversation."
      className="flex-1"
    />
  );
}
