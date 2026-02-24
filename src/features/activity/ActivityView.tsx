import { Bell } from 'lucide-react';
import { EmptyState } from '@/ui/EmptyState';

export function ActivityView() {
  return (
    <EmptyState
      icon={<Bell />}
      title="Activity"
      description="Select a notification from the sidebar to view details."
      className="flex-1"
    />
  );
}
