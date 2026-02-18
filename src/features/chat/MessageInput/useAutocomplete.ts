import { useState, useCallback, useMemo, useEffect, type RefObject } from 'react';

import { useMemberStore } from '@/stores/member';
import { useChannelStore } from '@/stores/channel';

import type { Member, Channel } from 'ecto-shared';

import { detectAutocomplete, type AutocompleteState } from '../autocomplete';

type UseAutocompleteOptions = {
  serverId: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (value: string) => void;
};

export function useAutocomplete({ serverId, textareaRef, content, setContent }: UseAutocompleteOptions) {
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const serverMembers = useMemberStore((s) => s.members.get(serverId));
  const serverChannels = useChannelStore((s) => s.channels.get(serverId));

  const filteredItems = useMemo(() => {
    if (!autocomplete) return [];
    const q = autocomplete.query.toLowerCase();

    if (autocomplete.type === '@') {
      if (!serverMembers) return [];
      const results: Member[] = [];
      for (const member of serverMembers.values()) {
        const match =
          member.display_name?.toLowerCase().includes(q) ||
          member.nickname?.toLowerCase().includes(q) ||
          member.username.toLowerCase().includes(q);
        if (match) {
          results.push(member);
          if (results.length >= 8) break;
        }
      }
      return results;
    }

    if (!serverChannels) return [];
    const results: Channel[] = [];
    for (const ch of serverChannels.values()) {
      if (ch.type === 'text' && ch.name.toLowerCase().includes(q)) {
        results.push(ch);
        if (results.length >= 8) break;
      }
    }
    return results;
  }, [autocomplete, serverMembers, serverChannels]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const selectItem = useCallback(
    (item: Member | Channel) => {
      if (!autocomplete || !textareaRef.current) return;

      const replacement =
        autocomplete.type === '@'
          ? `<@${(item as Member).user_id}> `
          : `<#${item.id}> `;

      const before = content.slice(0, autocomplete.startIndex);
      const after = content.slice(textareaRef.current.selectionStart);
      setContent(before + replacement + after);
      setAutocomplete(null);

      const cursorPos = before.length + replacement.length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [autocomplete, content, setContent, textareaRef],
  );

  const updateAutocomplete = useCallback(
    (value: string, cursorPos: number) => {
      setAutocomplete(detectAutocomplete(value, cursorPos));
    },
    [],
  );

  const handleAutocompleteKey = useCallback(
    (key: string): boolean => {
      if (!autocomplete || filteredItems.length === 0) return false;

      if (key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev <= 0 ? filteredItems.length - 1 : prev - 1));
        return true;
      }
      if (key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev >= filteredItems.length - 1 ? 0 : prev + 1));
        return true;
      }
      if (key === 'Enter' || key === 'Tab') {
        const item = filteredItems[selectedIndex];
        if (item) selectItem(item);
        return true;
      }
      if (key === 'Escape') {
        setAutocomplete(null);
        return true;
      }
      return false;
    },
    [autocomplete, filteredItems, selectedIndex, selectItem],
  );

  return {
    autocomplete,
    selectedIndex,
    filteredItems,
    selectItem,
    updateAutocomplete,
    handleAutocompleteKey,
  };
}
