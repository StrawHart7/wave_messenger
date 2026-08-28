import { listChats } from '../db/chats';
import { visibleChats, type ChatFilter, type ChatSummary } from '../services/chatList';
import { useLiveQuery } from './useLiveQuery';

export function useChats(options: { filter: ChatFilter; search: string; archived?: boolean }): ChatSummary[] {
  const all = useLiveQuery(() => listChats(), []);
  return visibleChats(all, options);
}

export function useArchivedCount(): number {
  const all = useLiveQuery(() => listChats(), []);
  return all.filter((chat) => chat.archived).length;
}
