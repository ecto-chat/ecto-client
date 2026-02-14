import { create } from 'zustand';
import type { Channel, Category } from 'ecto-shared';

interface ChannelStore {
  // serverId → channelId → Channel
  channels: Map<string, Map<string, Channel>>;
  // serverId → ordered channel IDs
  channelOrder: Map<string, string[]>;
  // serverId → categoryId → Category
  categories: Map<string, Map<string, Category>>;

  setChannels: (serverId: string, channels: Channel[]) => void;
  addChannel: (serverId: string, channel: Channel) => void;
  updateChannel: (serverId: string, channel: Partial<Channel> & { id: string }) => void;
  removeChannel: (serverId: string, channelId: string) => void;
  setCategories: (serverId: string, categories: Category[]) => void;
  addCategory: (serverId: string, category: Category) => void;
  updateCategory: (serverId: string, category: Partial<Category> & { id: string }) => void;
  removeCategory: (serverId: string, categoryId: string) => void;
  clearServer: (serverId: string) => void;
}

export const useChannelStore = create<ChannelStore>()((set) => ({
  channels: new Map(),
  channelOrder: new Map(),
  categories: new Map(),

  setChannels: (serverId, channelList) =>
    set((state) => {
      const channels = new Map(state.channels);
      const channelOrder = new Map(state.channelOrder);
      const serverChannels = new Map<string, Channel>();
      const order: string[] = [];
      for (const ch of channelList.sort((a, b) => a.position - b.position)) {
        serverChannels.set(ch.id, ch);
        order.push(ch.id);
      }
      channels.set(serverId, serverChannels);
      channelOrder.set(serverId, order);
      return { channels, channelOrder };
    }),

  addChannel: (serverId, channel) =>
    set((state) => {
      const channels = new Map(state.channels);
      const channelOrder = new Map(state.channelOrder);
      const serverChannels = new Map(channels.get(serverId) ?? new Map());
      serverChannels.set(channel.id, channel);
      channels.set(serverId, serverChannels);
      const existing = channelOrder.get(serverId) ?? [];
      if (!existing.includes(channel.id)) {
        channelOrder.set(serverId, [...existing, channel.id]);
      }
      return { channels, channelOrder };
    }),

  updateChannel: (serverId, channel) =>
    set((state) => {
      const existing = state.channels.get(serverId)?.get(channel.id);
      if (!existing) return state;
      const channels = new Map(state.channels);
      const serverChannels = new Map(channels.get(serverId)!);
      serverChannels.set(channel.id, { ...existing, ...channel });
      channels.set(serverId, serverChannels);
      return { channels };
    }),

  removeChannel: (serverId, channelId) =>
    set((state) => {
      const channels = new Map(state.channels);
      const channelOrder = new Map(state.channelOrder);
      const serverChannels = new Map(channels.get(serverId) ?? new Map());
      serverChannels.delete(channelId);
      channels.set(serverId, serverChannels);
      channelOrder.set(
        serverId,
        (channelOrder.get(serverId) ?? []).filter((id) => id !== channelId),
      );
      return { channels, channelOrder };
    }),

  setCategories: (serverId, categoryList) =>
    set((state) => {
      const categories = new Map(state.categories);
      const serverCategories = new Map<string, Category>();
      for (const cat of categoryList) {
        serverCategories.set(cat.id, cat);
      }
      categories.set(serverId, serverCategories);
      return { categories };
    }),

  addCategory: (serverId, category) =>
    set((state) => {
      const categories = new Map(state.categories);
      const serverCategories = new Map(categories.get(serverId) ?? new Map());
      serverCategories.set(category.id, category);
      categories.set(serverId, serverCategories);
      return { categories };
    }),

  updateCategory: (serverId, category) =>
    set((state) => {
      const existing = state.categories.get(serverId)?.get(category.id);
      if (!existing) return state;
      const categories = new Map(state.categories);
      const serverCategories = new Map(categories.get(serverId)!);
      serverCategories.set(category.id, { ...existing, ...category });
      categories.set(serverId, serverCategories);
      return { categories };
    }),

  removeCategory: (serverId, categoryId) =>
    set((state) => {
      const categories = new Map(state.categories);
      const serverCategories = new Map(categories.get(serverId) ?? new Map());
      serverCategories.delete(categoryId);
      categories.set(serverId, serverCategories);

      // Move channels from the deleted category to uncategorized (mirrors DB FK ON DELETE SET NULL)
      const channels = new Map(state.channels);
      const serverChannels = state.channels.get(serverId);
      if (serverChannels) {
        const updated = new Map(serverChannels);
        let changed = false;
        for (const [id, ch] of updated) {
          if (ch.category_id === categoryId) {
            updated.set(id, { ...ch, category_id: null });
            changed = true;
          }
        }
        if (changed) {
          channels.set(serverId, updated);
          return { categories, channels };
        }
      }
      return { categories };
    }),

  clearServer: (serverId) =>
    set((state) => {
      const channels = new Map(state.channels);
      const channelOrder = new Map(state.channelOrder);
      const categories = new Map(state.categories);
      channels.delete(serverId);
      channelOrder.delete(serverId);
      categories.delete(serverId);
      return { channels, channelOrder, categories };
    }),
}));
