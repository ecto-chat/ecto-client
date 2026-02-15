import type {
  Message,
  MessageAuthor,
  Channel,
  Category,
  Member,
  Role,
  Server,
  Invite,
  Ban,
  AuditLogEntry,
  ReadState,
  Attachment,
  ReactionGroup,
  VoiceState,
  GlobalUser,
  ServerListEntry,
  Friend,
  FriendRequest,
  DirectMessage,
  DMConversation,
} from 'ecto-shared';

// ---------- Server tRPC Router ----------

export interface ServerRouter {
  messages: {
    list: {
      query: (input: {
        channel_id: string;
        before?: string;
        after?: string;
        limit?: number;
        pinned_only?: boolean;
      }) => Promise<{ messages: Message[]; has_more: boolean }>;
    };
    send: {
      mutate: (input: {
        channel_id: string;
        content?: string;
        reply_to?: string;
        attachment_ids?: string[];
      }) => Promise<Message>;
    };
    update: {
      mutate: (input: { message_id: string; content: string }) => Promise<Message>;
    };
    delete: {
      mutate: (input: { message_id: string }) => Promise<{ success: boolean }>;
    };
    pin: {
      mutate: (input: { message_id: string; pinned: boolean }) => Promise<Message>;
    };
    react: {
      mutate: (input: {
        message_id: string;
        emoji: string;
        action: 'add' | 'remove';
      }) => Promise<ReactionGroup[]>;
    };
  };

  channels: {
    list: {
      query: () => Promise<{
        categories: (Category & { channels: Channel[] })[];
        uncategorized: Channel[];
      }>;
    };
    create: {
      mutate: (input: {
        name: string;
        type: 'text' | 'voice';
        category_id?: string;
        topic?: string;
        permission_overrides?: { target_type: 'role' | 'member'; target_id: string; allow: number; deny: number }[];
      }) => Promise<Channel>;
    };
    update: {
      mutate: (input: {
        channel_id: string;
        name?: string;
        topic?: string;
        category_id?: string;
        permission_overrides?: { target_type: 'role' | 'member'; target_id: string; allow: number; deny: number }[];
      }) => Promise<Channel>;
    };
    delete: {
      mutate: (input: { channel_id: string }) => Promise<{ success: boolean }>;
    };
    reorder: {
      mutate: (input: {
        channels: { channel_id: string; position: number; category_id?: string }[];
      }) => Promise<{ success: boolean }>;
    };
  };

  categories: {
    create: {
      mutate: (input: { name: string }) => Promise<Category>;
    };
    update: {
      mutate: (input: { category_id: string; name: string }) => Promise<Category>;
    };
    delete: {
      mutate: (input: { category_id: string }) => Promise<{ success: boolean }>;
    };
    reorder: {
      mutate: (input: {
        categories: { category_id: string; position: number }[];
      }) => Promise<{ success: boolean }>;
    };
  };

  members: {
    list: {
      query: (input: {
        limit?: number;
        after?: string;
        role_id?: string;
        search?: string;
      }) => Promise<{ members: Member[]; total: number; has_more: boolean }>;
    };
    kick: {
      mutate: (input: { user_id: string; reason?: string }) => Promise<{ success: boolean }>;
    };
    ban: {
      mutate: (input: {
        user_id: string;
        reason?: string;
        delete_messages?: '1h' | '24h' | '7d';
      }) => Promise<{ success: boolean }>;
    };
    unban: {
      mutate: (input: { user_id: string }) => Promise<{ success: boolean }>;
    };
    updateRoles: {
      mutate: (input: { user_id: string; role_ids: string[] }) => Promise<Member>;
    };
    updateNickname: {
      mutate: (input: { user_id: string; nickname?: string | null }) => Promise<Member>;
    };
    voiceMute: {
      mutate: (input: {
        user_id: string;
        server_mute?: boolean;
        server_deaf?: boolean;
      }) => Promise<VoiceState>;
    };
    updateDmPreference: {
      mutate: (input: { allow_dms: boolean }) => Promise<{ success: boolean }>;
    };
  };

  bans: {
    list: {
      query: () => Promise<Ban[]>;
    };
  };

  roles: {
    list: {
      query: () => Promise<Role[]>;
    };
    create: {
      mutate: (input: {
        name: string;
        color?: string;
        permissions?: number;
        position?: number;
      }) => Promise<Role>;
    };
    update: {
      mutate: (input: {
        role_id: string;
        name?: string;
        color?: string;
        permissions?: number;
        position?: number;
      }) => Promise<Role>;
    };
    delete: {
      mutate: (input: { role_id: string }) => Promise<{ success: boolean }>;
    };
    reorder: {
      mutate: (input: {
        roles: { role_id: string; position: number }[];
      }) => Promise<{ success: boolean }>;
    };
  };

  server: {
    info: {
      query: (input?: { invite_code?: string }) => Promise<{
        server: Server;
        member_count: number;
        online_count: number;
        channels?: Channel[];
      }>;
    };
    update: {
      mutate: (input: {
        name?: string;
        description?: string;
        icon_url?: string;
      }) => Promise<Server>;
    };
    join: {
      mutate: (input?: { invite_code?: string }) => Promise<{
        server_token: string;
        server: Server;
        member: Member;
      }>;
    };
    leave: {
      mutate: () => Promise<{ success: boolean }>;
    };
    delete: {
      mutate: (input: { confirmation: string }) => Promise<{ success: boolean }>;
    };
    uploadIcon: {
      mutate: (input: { file: File }) => Promise<{
        icon_url: string;
        sizes: { 64: string; 128: string; 256: string; 512: string };
      }>;
    };
    dms: {
      open: {
        mutate: (input: { user_id: string }) => Promise<{
          conversation_id: string;
          created: boolean;
        }>;
      };
      list: {
        query: () => Promise<DMConversation[]>;
      };
    };
  };

  invites: {
    create: {
      mutate: (input: {
        max_uses?: number | null;
        expires_in?: number | null;
      }) => Promise<{ invite: Invite; url: string }>;
    };
    list: {
      query: () => Promise<Invite[]>;
    };
    revoke: {
      mutate: (input: { invite_id: string }) => Promise<{ success: boolean }>;
    };
  };

  files: {
    upload: {
      mutate: (input: {
        channel_id: string;
        filename: string;
        content_type: string;
        size_bytes: number;
      }) => Promise<Attachment>;
    };
    getUrl: {
      query: (input: { attachment_id: string }) => Promise<{
        url: string;
        filename: string;
        content_type: string;
        size_bytes: number;
      }>;
    };
  };

  read_state: {
    update: {
      mutate: (input: {
        channel_id: string;
        last_read_message_id: string;
      }) => Promise<{ success: boolean }>;
    };
    markAllRead: {
      mutate: () => Promise<{ success: boolean }>;
    };
    list: {
      query: () => Promise<ReadState[]>;
    };
  };

  auditlog: {
    list: {
      query: (input: {
        before?: string;
        limit?: number;
        action?: string;
        actor_id?: string;
      }) => Promise<{ entries: AuditLogEntry[]; has_more: boolean }>;
    };
  };

  serverConfig: {
    get: {
      query: () => Promise<{
        max_upload_size_bytes: number;
        allow_local_accounts: boolean;
        require_invite: boolean;
        allow_member_dms: boolean;
        version: string;
      }>;
    };
    update: {
      mutate: (input: {
        max_upload_size_bytes?: number;
        allow_local_accounts?: boolean;
        require_invite?: boolean;
        allow_member_dms?: boolean;
      }) => Promise<{ success: boolean }>;
    };
    completeSetup: {
      mutate: () => Promise<{ success: boolean }>;
    };
  };
}

// ---------- Central tRPC Router ----------

export interface CentralRouter {
  auth: {
    register: {
      mutate: (input: {
        email: string;
        password: string;
        username: string;
      }) => Promise<{ user: GlobalUser; access_token: string; refresh_token: string }>;
    };
    login: {
      mutate: (input: {
        email: string;
        password: string;
      }) => Promise<{ user: GlobalUser; access_token: string; refresh_token: string }>;
    };
    loginGoogle: {
      mutate: (input: {
        google_token: string;
      }) => Promise<{
        user: GlobalUser;
        access_token: string;
        refresh_token: string;
        is_new: boolean;
      }>;
    };
    refresh: {
      mutate: (input: { refresh_token: string }) => Promise<{ access_token: string; refresh_token: string }>;
    };
    logout: {
      mutate: (input: { refresh_token: string }) => Promise<{ success: boolean }>;
    };
    changePassword: {
      mutate: (input: {
        current_password: string;
        new_password: string;
      }) => Promise<{ success: boolean }>;
    };
    deleteAccount: {
      mutate: (input: {
        password: string;
        reason?: string;
      }) => Promise<{ scheduled_at: string }>;
    };
    cancelDeletion: {
      mutate: () => Promise<{ success: boolean }>;
    };
  };

  profile: {
    get: {
      query: (input: { user_id: string }) => Promise<GlobalUser>;
    };
    update: {
      mutate: (input: {
        display_name?: string | null;
        avatar_url?: string | null;
        bio?: string | null;
        custom_status?: string | null;
        allow_dms_from_strangers?: boolean;
      }) => Promise<GlobalUser>;
    };
    uploadAvatar: {
      mutate: (input: { file: File }) => Promise<{
        avatar_url: string;
        sizes: { 64: string; 128: string; 256: string; 512: string };
      }>;
    };
    getByTag: {
      query: (input: {
        username: string;
        discriminator: string;
      }) => Promise<GlobalUser | null>;
    };
  };

  friends: {
    list: {
      query: () => Promise<{
        friends: Friend[];
        incoming: FriendRequest[];
        outgoing: FriendRequest[];
      }>;
    };
    request: {
      mutate: (input: {
        username: string;
        discriminator: string;
      }) => Promise<FriendRequest>;
    };
    accept: {
      mutate: (input: { friendship_id: string }) => Promise<Friend>;
    };
    decline: {
      mutate: (input: { friendship_id: string }) => Promise<{ success: boolean }>;
    };
    remove: {
      mutate: (input: { user_id: string }) => Promise<{ success: boolean }>;
    };
    block: {
      mutate: (input: { user_id: string }) => Promise<{ success: boolean }>;
    };
    unblock: {
      mutate: (input: { user_id: string }) => Promise<{ success: boolean }>;
    };
  };

  dms: {
    list: {
      query: () => Promise<DMConversation[]>;
    };
    send: {
      mutate: (input: {
        recipient_id: string;
        content: string;
        attachment_ids?: string[];
      }) => Promise<DirectMessage>;
    };
    history: {
      query: (input: {
        user_id: string;
        before?: string;
        limit?: number;
      }) => Promise<{ messages: DirectMessage[]; has_more: boolean }>;
    };
    markRead: {
      mutate: (input: {
        user_id: string;
        last_read_message_id: string;
      }) => Promise<{ success: boolean }>;
    };
    edit: {
      mutate: (input: {
        message_id: string;
        content: string;
      }) => Promise<DirectMessage>;
    };
    react: {
      mutate: (input: {
        message_id: string;
        emoji: string;
      }) => Promise<{ reactions: ReactionGroup[] }>;
    };
  };

  servers: {
    list: {
      query: () => Promise<ServerListEntry[]>;
    };
    add: {
      mutate: (input: {
        server_address: string;
        server_name?: string;
        server_icon?: string;
      }) => Promise<ServerListEntry>;
    };
    remove: {
      mutate: (input: { server_address: string }) => Promise<{ success: boolean }>;
    };
    reorder: {
      mutate: (input: {
        servers: { server_address: string; position: number }[];
      }) => Promise<{ success: boolean }>;
    };
  };

  calls: {
    history: {
      query: (input: {
        filter?: 'all' | 'missed' | 'incoming' | 'outgoing';
        cursor?: string;
        limit?: number;
      }) => Promise<{ records: import('ecto-shared').CallRecord[]; has_more: boolean }>;
    };
    delete: {
      mutate: (input: { call_record_id: string }) => Promise<{ success: boolean }>;
    };
  };
}

// ---------- tRPC Client Types ----------

/** A lightweight tRPC-like client interface for server connections */
export type ServerTrpcClient = ServerRouter;

/** A lightweight tRPC-like client interface for central connection */
export type CentralTrpcClient = CentralRouter;
