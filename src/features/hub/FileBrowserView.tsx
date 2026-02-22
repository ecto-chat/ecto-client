import { useEffect } from 'react';
import { FolderOpen } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent, ScrollArea } from '@/ui';

import { useHubFilesStore } from '@/stores/hub-files';

import { SharedTab } from './SharedTab';
import { ServerTab } from './ServerTab';

export function FileBrowserView() {
  const activeTab = useHubFilesStore((s) => s.activeTab);
  const setActiveTab = useHubFilesStore((s) => s.setActiveTab);

  useEffect(() => {
    return () => { useHubFilesStore.getState().clear(); };
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-border px-4">
        <FolderOpen size={18} className="text-muted" />
        <span className="text-sm font-medium text-primary">File Browser</span>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'shared' | 'server')}>
            <TabsList>
              <TabsTrigger value="shared">Shared</TabsTrigger>
              <TabsTrigger value="server">Server</TabsTrigger>
            </TabsList>
            <TabsContent value="shared">
              <SharedTab />
            </TabsContent>
            <TabsContent value="server">
              <ServerTab />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
