import { create } from 'zustand';
import type { Friend, FriendRequest } from 'ecto-shared';

interface FriendStore {
  friends: Map<string, Friend>;
  pendingIncoming: Map<string, FriendRequest>;
  pendingOutgoing: Map<string, FriendRequest>;
  blocked: Set<string>;

  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;
  removeFriend: (userId: string) => void;
  setIncomingRequests: (requests: FriendRequest[]) => void;
  setOutgoingRequests: (requests: FriendRequest[]) => void;
  addIncomingRequest: (request: FriendRequest) => void;
  addOutgoingRequest: (request: FriendRequest) => void;
  acceptedRequest: (friend: Friend) => void;
  removeRequest: (requestId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
}

export const useFriendStore = create<FriendStore>()((set) => ({
  friends: new Map(),
  pendingIncoming: new Map(),
  pendingOutgoing: new Map(),
  blocked: new Set(),

  setFriends: (friendList) => {
    const friends = new Map<string, Friend>();
    for (const f of friendList) friends.set(f.user_id, f);
    set({ friends });
  },

  addFriend: (friend) =>
    set((state) => {
      const friends = new Map(state.friends);
      friends.set(friend.user_id, friend);
      return { friends };
    }),

  removeFriend: (userId) =>
    set((state) => {
      const friends = new Map(state.friends);
      friends.delete(userId);
      return { friends };
    }),

  setIncomingRequests: (requests) => {
    const pendingIncoming = new Map<string, FriendRequest>();
    for (const r of requests) pendingIncoming.set(r.id, r);
    set({ pendingIncoming });
  },

  setOutgoingRequests: (requests) => {
    const pendingOutgoing = new Map<string, FriendRequest>();
    for (const r of requests) pendingOutgoing.set(r.id, r);
    set({ pendingOutgoing });
  },

  addIncomingRequest: (request) =>
    set((state) => {
      const pendingIncoming = new Map(state.pendingIncoming);
      pendingIncoming.set(request.id, request);
      return { pendingIncoming };
    }),

  addOutgoingRequest: (request) =>
    set((state) => {
      const pendingOutgoing = new Map(state.pendingOutgoing);
      pendingOutgoing.set(request.id, request);
      return { pendingOutgoing };
    }),

  acceptedRequest: (friend) =>
    set((state) => {
      const friends = new Map(state.friends);
      friends.set(friend.user_id, friend);
      // Remove any pending request for this user
      const pendingIncoming = new Map(state.pendingIncoming);
      const pendingOutgoing = new Map(state.pendingOutgoing);
      for (const [id, req] of pendingIncoming) {
        if (req.from === friend.user_id) pendingIncoming.delete(id);
      }
      for (const [id, req] of pendingOutgoing) {
        if (req.from === friend.user_id) pendingOutgoing.delete(id);
      }
      return { friends, pendingIncoming, pendingOutgoing };
    }),

  removeRequest: (requestId) =>
    set((state) => {
      const pendingIncoming = new Map(state.pendingIncoming);
      const pendingOutgoing = new Map(state.pendingOutgoing);
      pendingIncoming.delete(requestId);
      pendingOutgoing.delete(requestId);
      return { pendingIncoming, pendingOutgoing };
    }),

  blockUser: (userId) =>
    set((state) => {
      const blocked = new Set(state.blocked);
      blocked.add(userId);
      const friends = new Map(state.friends);
      friends.delete(userId);
      return { blocked, friends };
    }),

  unblockUser: (userId) =>
    set((state) => {
      const blocked = new Set(state.blocked);
      blocked.delete(userId);
      return { blocked };
    }),
}));
