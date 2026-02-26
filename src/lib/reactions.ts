import type { ReactionGroup } from 'ecto-shared';

/** Compute optimistic reaction toggle. Returns new reactions array. */
export function toggleReaction(
  reactions: ReactionGroup[],
  emoji: string,
  currentUserId: string,
): ReactionGroup[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  const isRemoving = existing?.me;

  if (isRemoving && existing) {
    const newUsers = existing.users.filter((u) => u !== currentUserId);
    if (newUsers.length === 0) {
      return reactions.filter((r) => r.emoji !== emoji);
    }
    return reactions.map((r) =>
      r.emoji === emoji ? { ...r, count: newUsers.length, users: newUsers, me: false } : r,
    );
  }

  if (existing) {
    return reactions.map((r) =>
      r.emoji === emoji
        ? { ...r, count: r.count + 1, users: [...r.users, currentUserId], me: true }
        : r,
    );
  }

  return [...reactions, { emoji, count: 1, users: [currentUserId], me: true }];
}
