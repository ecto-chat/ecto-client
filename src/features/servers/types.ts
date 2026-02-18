export type LocalJoinStage =
  | 'idle'
  | 'preview'
  | 'joining'
  | 'no-local-accounts';

export type ServerPreviewData = {
  name: string;
  icon_url: string | null;
  member_count: number;
  online_count: number;
  require_invite: boolean;
  allow_local_accounts: boolean;
};
