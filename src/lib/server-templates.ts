export interface ServerTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  channels: { name: string; type: 'text' | 'voice' }[];
  roles: { name: string; color: string }[];
}

export const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'For gaming communities with voice channels for different games.',
    icon: '\u{1F3AE}',
    channels: [
      { name: 'general', type: 'text' },
      { name: 'looking-for-group', type: 'text' },
      { name: 'clips-and-highlights', type: 'text' },
      { name: 'Game Room 1', type: 'voice' },
      { name: 'Game Room 2', type: 'voice' },
      { name: 'AFK', type: 'voice' },
    ],
    roles: [
      { name: 'Moderator', color: '#3498db' },
      { name: 'Regular', color: '#2ecc71' },
    ],
  },
  {
    id: 'study',
    name: 'Study Group',
    description: 'For study groups and academic collaboration.',
    icon: '\u{1F4DA}',
    channels: [
      { name: 'general', type: 'text' },
      { name: 'resources', type: 'text' },
      { name: 'help', type: 'text' },
      { name: 'off-topic', type: 'text' },
      { name: 'Study Room', type: 'voice' },
      { name: 'Quiet Study', type: 'voice' },
    ],
    roles: [
      { name: 'Tutor', color: '#9b59b6' },
      { name: 'Student', color: '#1abc9c' },
    ],
  },
  {
    id: 'community',
    name: 'Community',
    description: 'A general community server for hanging out and chatting.',
    icon: '\u{1F30D}',
    channels: [
      { name: 'welcome', type: 'text' },
      { name: 'general', type: 'text' },
      { name: 'introductions', type: 'text' },
      { name: 'media', type: 'text' },
      { name: 'off-topic', type: 'text' },
      { name: 'Lounge', type: 'voice' },
      { name: 'Music', type: 'voice' },
    ],
    roles: [
      { name: 'Moderator', color: '#e74c3c' },
      { name: 'Member', color: '#3498db' },
    ],
  },
  {
    id: 'team',
    name: 'Team / Work',
    description: 'For teams and workgroups with project-focused channels.',
    icon: '\u{1F4BC}',
    channels: [
      { name: 'announcements', type: 'text' },
      { name: 'general', type: 'text' },
      { name: 'projects', type: 'text' },
      { name: 'standup', type: 'text' },
      { name: 'Meeting Room', type: 'voice' },
      { name: 'Pair Programming', type: 'voice' },
    ],
    roles: [
      { name: 'Lead', color: '#e67e22' },
      { name: 'Team Member', color: '#2ecc71' },
    ],
  },
  {
    id: 'creator',
    name: 'Content Creator',
    description: 'For streamers, artists, and content creators.',
    icon: '\u{1F3A8}',
    channels: [
      { name: 'announcements', type: 'text' },
      { name: 'general', type: 'text' },
      { name: 'showcase', type: 'text' },
      { name: 'feedback', type: 'text' },
      { name: 'behind-the-scenes', type: 'text' },
      { name: 'Hangout', type: 'voice' },
      { name: 'Watch Party', type: 'voice' },
    ],
    roles: [
      { name: 'Moderator', color: '#e74c3c' },
      { name: 'Supporter', color: '#f1c40f' },
    ],
  },
  {
    id: 'friends',
    name: 'Friends',
    description: 'A small server for hanging out with friends.',
    icon: '\u{1F91D}',
    channels: [
      { name: 'general', type: 'text' },
      { name: 'memes', type: 'text' },
      { name: 'plans', type: 'text' },
      { name: 'Hangout', type: 'voice' },
      { name: 'Movie Night', type: 'voice' },
    ],
    roles: [],
  },
];
