import { useCallback } from 'react';

import { AnimatePresence, motion } from 'motion/react';

import { Button, ConfirmDialog } from '@/ui';

import { useVoiceStore } from '@/stores/voice';

import { useVoice } from '@/hooks/useVoice';

import { VoiceToolbarControls } from './VoiceToolbarControls';

type VoiceToolbarProps = {
  serverId: string;
  channelId: string;
  isConnectedHere: boolean;
};

export function VoiceToolbar({ serverId, channelId, isConnectedHere }: VoiceToolbarProps) {
  const voiceStatus = useVoiceStore((s) => s.voiceStatus);
  const { pendingTransfer, joinVoice, confirmTransfer, cancelTransfer } = useVoice();

  const handleJoin = useCallback(() => {
    joinVoice(serverId, channelId);
  }, [serverId, channelId, joinVoice]);

  const isCall = pendingTransfer?.currentChannelId === 'call';
  const transferTitle = isCall
    ? 'End call and join voice?'
    : pendingTransfer?.sameSession
      ? 'Switch voice channel?'
      : 'Transfer voice session?';
  const transferDesc = isCall
    ? 'You are currently in a call. Joining this voice channel will end the call.'
    : pendingTransfer?.sameSession
      ? 'You will be moved to this voice channel.'
      : 'You are connected on another session. Transfer your voice connection here?';

  return (
    <div className="shrink-0 border-t border-border bg-secondary px-4 py-3">
      <ConfirmDialog
        open={!!pendingTransfer}
        onOpenChange={(open) => { if (!open) cancelTransfer(); }}
        title={transferTitle}
        description={transferDesc}
        confirmLabel={isCall ? 'End Call & Join' : 'Transfer'}
        cancelLabel="Cancel"
        onConfirm={confirmTransfer}
      />

      {isConnectedHere ? (
        <VoiceToolbarControls />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="flex justify-center"
          >
            <Button
              variant="primary"
              size="lg"
              loading={voiceStatus === 'connecting'}
              onClick={handleJoin}
            >
              {voiceStatus === 'connecting' ? 'Connecting...' : 'Join Voice'}
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
