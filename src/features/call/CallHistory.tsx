import { useEffect, useCallback, useState } from 'react';

import { PhoneOff } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent, ScrollArea, EmptyState, Button } from '@/ui';

import { useCallStore } from '@/stores/call';
import { useAuthStore } from '@/stores/auth';
import { useCall } from '@/hooks/useCall';
import { connectionManager } from '@/services/connection-manager';
import { useUiStore } from '@/stores/ui';

import { CallHistoryEntry } from './CallHistoryEntry';

type HistoryFilter = 'all' | 'missed' | 'incoming' | 'outgoing';

export function CallHistory() {
  const centralAuthState = useAuthStore((s) => s.centralAuthState);

  if (centralAuthState !== 'authenticated') {
    return <CentralSignInPrompt />;
  }

  return <CallHistoryInner />;
}

function CentralSignInPrompt() {
  const handleSignIn = () => {
    useUiStore.getState().openModal('central-sign-in');
  };

  return (
    <EmptyState
      icon={<PhoneOff />}
      title="Sign in to Ecto Central"
      description="Connect your Ecto account to view call history and make calls."
      action={<Button onClick={handleSignIn}>Sign In</Button>}
    />
  );
}

function CallHistoryInner() {
  const callHistory = useCallStore((s) => s.callHistory);
  const historyHasMore = useCallStore((s) => s.historyHasMore);
  const historyFilter = useCallStore((s) => s.historyFilter);
  const { startCall } = useCall();
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (filter: HistoryFilter, cursor?: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    setLoading(true);
    try {
      const result = await centralTrpc.calls.history.query({ filter, cursor, limit: 25 });
      if (cursor) {
        useCallStore.getState().appendCallHistory(result.records, result.has_more);
      } else {
        useCallStore.getState().setCallHistory(result.records, result.has_more);
      }
    } catch (err) {
      console.error('[calls] failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(historyFilter);
  }, [historyFilter, loadHistory]);

  const handleFilterChange = (filter: string) => {
    useCallStore.getState().setHistoryFilter(filter as HistoryFilter);
  };

  const handleLoadMore = () => {
    const last = callHistory[callHistory.length - 1];
    if (last) loadHistory(historyFilter, last.id);
  };

  const handleDelete = useCallback(async (recordId: string) => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    useCallStore.getState().removeCallRecord(recordId);
    try {
      await centralTrpc.calls.delete.mutate({ call_record_id: recordId });
    } catch {
      loadHistory(historyFilter);
    }
  }, [historyFilter, loadHistory]);

  const handleCallBack = (userId: string) => {
    startCall(userId, ['audio']);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <Tabs value={historyFilter} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="missed">Missed</TabsTrigger>
          <TabsTrigger value="incoming">Incoming</TabsTrigger>
          <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
        </TabsList>
        {(['all', 'missed', 'incoming', 'outgoing'] as const).map((f) => (
          <TabsContent key={f} value={f}>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="flex flex-col gap-0.5">
                {callHistory.map((record) => (
                  <CallHistoryEntry
                    key={record.id}
                    record={record}
                    onCallBack={handleCallBack}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              {callHistory.length === 0 && !loading && (
                <EmptyState
                  icon={<PhoneOff />}
                  title="No call history"
                  description="Your calls will appear here."
                />
              )}

              {historyHasMore && callHistory.length > 0 && (
                <div className="flex justify-center py-3">
                  <Button variant="secondary" size="sm" onClick={handleLoadMore} loading={loading}>
                    Load More
                  </Button>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
