import { useEffect, useRef, useState } from 'react';

import { useVoiceStore } from '@/stores/voice';

/**
 * Tracks the most active speaker with hysteresis to prevent rapid switching.
 * Uses setInterval polling (200ms) instead of store subscriptions to avoid
 * excessive re-renders from high-frequency audio level updates.
 */
export function useActiveSpeaker(): string | null {
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const scoresRef = useRef(new Map<string, number>());
  const currentRef = useRef<string | null>(null);

  useEffect(() => {
    const SWITCH_MARGIN = 3;

    const interval = setInterval(() => {
      const { speaking, audioLevels } = useVoiceStore.getState();
      const scores = scoresRef.current;

      // Update scores for all tracked users
      for (const [userId, score] of scores) {
        if (speaking.has(userId)) {
          const level = audioLevels.get(userId) ?? 0.5;
          scores.set(userId, score + 1 * level);
        } else {
          scores.set(userId, Math.max(0, score - 0.3));
        }
      }

      // Add new speaking users
      for (const userId of speaking) {
        if (!scores.has(userId)) {
          const level = audioLevels.get(userId) ?? 0.5;
          scores.set(userId, level);
        }
      }

      // Find the top scorer
      let topUser: string | null = null;
      let topScore = 0;
      for (const [userId, score] of scores) {
        if (score > topScore) {
          topScore = score;
          topUser = userId;
        }
      }

      const current = currentRef.current;

      // Switch only if challenger exceeds current by margin
      if (topUser && topUser !== current) {
        const currentScore = current ? (scores.get(current) ?? 0) : 0;
        if (topScore > currentScore + SWITCH_MARGIN) {
          currentRef.current = topUser;
          setActiveSpeaker(topUser);
        }
      }

      // If current speaker score is 0 and someone else is speaking, switch immediately
      if (current && (scores.get(current) ?? 0) === 0 && topUser && topUser !== current) {
        currentRef.current = topUser;
        setActiveSpeaker(topUser);
      }

      // Clean up zero-score non-speaking users
      for (const [userId, score] of scores) {
        if (score === 0 && !speaking.has(userId)) {
          scores.delete(userId);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return activeSpeaker;
}
