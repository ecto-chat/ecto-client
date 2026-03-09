import { useEffect } from 'react';
import { useMessageStore } from 'ecto-core';

export function useNotifications() {
  // Clear expired typing indicators every 2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      useMessageStore.getState().clearExpiredTyping();
    }, 2000);
    return () => clearInterval(timer);
  }, []);
}
