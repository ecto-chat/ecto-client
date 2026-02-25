export type LayoutTier = 'solo' | 'duo' | 'trio' | 'quad' | 'spotlight';

export type GridSlot = {
  id: string;
  isSpotlight: boolean;
  enforceAspectRatio: boolean;
};

export type GridLayout = {
  tier: LayoutTier;
  slots: GridSlot[];
};

/**
 * Compute the grid layout for a set of participant slot IDs.
 * Screen shares should be passed as `${userId}:screen` IDs.
 */
export function computeGridLayout(
  participantIds: string[],
  pinnedUserId: string | null,
  activeSpeakerId: string | null,
): GridLayout {
  const count = participantIds.length;

  if (count === 0) {
    return { tier: 'solo', slots: [] };
  }

  // If someone is pinned, always use spotlight layout
  if (pinnedUserId && participantIds.includes(pinnedUserId)) {
    return buildSpotlight(participantIds, pinnedUserId);
  }

  switch (count) {
    case 1: {
      const id = participantIds[0];
      if (!id) return { tier: 'solo', slots: [] };
      return {
        tier: 'solo',
        slots: [{ id, isSpotlight: false, enforceAspectRatio: true }],
      };
    }
    case 2:
      return {
        tier: 'duo',
        slots: participantIds.map((id) => ({ id, isSpotlight: false, enforceAspectRatio: true })),
      };
    case 3:
      return {
        tier: 'trio',
        slots: participantIds.map((id) => ({ id, isSpotlight: false, enforceAspectRatio: true })),
      };
    case 4:
      return {
        tier: 'quad',
        slots: participantIds.map((id) => ({ id, isSpotlight: false, enforceAspectRatio: false })),
      };
    default: {
      // 5+ participants — spotlight layout
      // Priority: screen shares > active speaker > first participant
      const screenShare = participantIds.find((id) => id.endsWith(':screen'));
      const firstId = participantIds[0];
      if (!firstId) return { tier: 'spotlight', slots: [] };
      const spotlightTarget = screenShare ?? activeSpeakerId ?? firstId;
      return buildSpotlight(participantIds, spotlightTarget);
    }
  }
}

function buildSpotlight(participantIds: string[], spotlightId: string): GridLayout {
  const slots: GridSlot[] = [
    { id: spotlightId, isSpotlight: true, enforceAspectRatio: false },
  ];

  for (const id of participantIds) {
    if (id !== spotlightId) {
      slots.push({ id, isSpotlight: false, enforceAspectRatio: true });
    }
  }

  return { tier: 'spotlight', slots };
}
