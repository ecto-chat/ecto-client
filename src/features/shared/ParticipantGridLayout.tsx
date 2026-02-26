import type { ReactNode } from 'react';
import type { VoiceState } from 'ecto-shared';

import { useActiveSpeaker } from '@/hooks/useActiveSpeaker';
import { computeGridLayout, type GridSlot } from '@/lib/grid-layout';

export type ParticipantSlot = {
  id: string;
  participant: VoiceState;
  displayName: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  videoStream?: MediaStream;
  screenStream?: MediaStream;
};

type ParticipantGridLayoutProps = {
  participants: ParticipantSlot[];
  pinnedUserId: string | null;
  renderParticipant: (slot: GridSlot, participant: ParticipantSlot) => ReactNode;
};

export function ParticipantGridLayout({
  participants,
  pinnedUserId,
  renderParticipant,
}: ParticipantGridLayoutProps) {
  const activeSpeakerId = useActiveSpeaker();

  // Build slot IDs: each participant + their screen share as a separate slot
  const slotIds: string[] = [];
  const slotMap = new Map<string, ParticipantSlot>();

  for (const p of participants) {
    slotIds.push(p.id);
    slotMap.set(p.id, p);

    if (p.screenStream) {
      const screenId = `${p.id}:screen`;
      slotIds.push(screenId);
      slotMap.set(screenId, {
        ...p,
        id: screenId,
        videoStream: p.screenStream,
        screenStream: undefined,
        displayName: `${p.displayName}'s screen`,
      });
    }
  }

  const layout = computeGridLayout(slotIds, pinnedUserId, activeSpeakerId);

  const renderSlot = (slot: GridSlot) => {
    const participant = slotMap.get(slot.id);
    if (!participant) return null;
    return renderParticipant(slot, participant);
  };

  switch (layout.tier) {
    case 'solo':
      return (
        <div className="flex h-full items-center justify-center p-4">
          <div className="aspect-video w-full max-h-full">
            {layout.slots[0] && renderSlot(layout.slots[0])}
          </div>
        </div>
      );

    case 'duo':
      return (
        <div className="grid h-full grid-cols-2 items-center gap-4 p-4">
          {layout.slots.map((slot) => (
            <div key={slot.id} className="aspect-video">
              {renderSlot(slot)}
            </div>
          ))}
        </div>
      );

    case 'trio':
      return (
        <div className="grid h-full grid-cols-2 grid-rows-2 items-center gap-4 p-4">
          {layout.slots[0] && (
            <div key={layout.slots[0].id} className="aspect-video">
              {renderSlot(layout.slots[0])}
            </div>
          )}
          {layout.slots[1] && (
            <div key={layout.slots[1].id} className="aspect-video">
              {renderSlot(layout.slots[1])}
            </div>
          )}
          {layout.slots[2] && (
            <div key={layout.slots[2].id} className="col-span-2 flex justify-center">
              <div className="aspect-video w-1/2">
                {renderSlot(layout.slots[2])}
              </div>
            </div>
          )}
        </div>
      );

    case 'quad':
      return (
        <div className="grid h-full grid-cols-2 grid-rows-2 gap-4 p-4">
          {layout.slots.map((slot) => (
            <div key={slot.id} className="aspect-video">
              {renderSlot(slot)}
            </div>
          ))}
        </div>
      );

    case 'spotlight': {
      const [spotlightSlot, ...thumbnailSlots] = layout.slots;
      return (
        <div className="flex h-full flex-col gap-3 p-4">
          {/* Spotlight area */}
          <div className="min-h-0 flex-1">
            {spotlightSlot && renderSlot(spotlightSlot)}
          </div>

          {/* Thumbnail strip */}
          {thumbnailSlots.length > 0 && (
            <div className="flex h-[140px] shrink-0 items-center gap-3 overflow-x-auto py-1">
              {thumbnailSlots.map((slot) => renderSlot(slot))}
            </div>
          )}
        </div>
      );
    }
  }
}
