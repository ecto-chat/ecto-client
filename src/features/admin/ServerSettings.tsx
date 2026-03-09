import { useState, useEffect, useMemo } from 'react';

import { Button, Modal } from '@/ui';

import { useUiStore, useServerStore } from 'ecto-core';

import { usePermissions } from '@/hooks/usePermissions';

import { cn } from '@/lib/cn';

import { AppearanceSettings } from './AppearanceSettings';
import { ConfigurationSettings } from './ConfigurationSettings';
import { DiscoverySettings } from './DiscoverySettings';
import { BansTab } from './SecuritySettings';
import { DangerZone } from './DangerZone';
import { InvitesTab } from './InvitesTab';
import { AuditLogTab } from './AuditLogTab';
import { RoleEditor } from './RoleEditor';
import { ChannelEditor } from './ChannelEditor';
import { MemberManager } from './MemberManager';
import { WebhookManager } from './WebhookManager';

type Tab = 'appearance' | 'configuration' | 'discovery' | 'roles' | 'channels' | 'members' | 'bans' | 'invites' | 'webhooks' | 'audit-log' | 'danger';

type TabSection = {
  label: string;
  tabs: { key: Tab; label: string }[];
};

const TAB_SECTIONS: TabSection[] = [
  {
    label: 'Server',
    tabs: [
      { key: 'appearance', label: 'Appearance' },
      { key: 'configuration', label: 'Configuration' },
      { key: 'discovery', label: 'Discovery' },
    ],
  },
  {
    label: 'Management',
    tabs: [
      { key: 'channels', label: 'Channels' },
      { key: 'roles', label: 'Roles' },
      { key: 'members', label: 'Members' },
    ],
  },
  {
    label: 'Moderation',
    tabs: [
      { key: 'invites', label: 'Invites' },
      { key: 'bans', label: 'Bans' },
      { key: 'audit-log', label: 'Audit Log' },
    ],
  },
  {
    label: 'Advanced',
    tabs: [
      { key: 'webhooks', label: 'Webhooks' },
      { key: 'danger', label: 'Danger Zone' },
    ],
  },
];

const ALL_TABS = TAB_SECTIONS.flatMap((s) => s.tabs);

function TabPanel({ activeTab, serverId }: { activeTab: Tab; serverId: string }) {
  switch (activeTab) {
    case 'appearance': return <AppearanceSettings serverId={serverId} />;
    case 'configuration': return <ConfigurationSettings serverId={serverId} />;
    case 'discovery': return <DiscoverySettings serverId={serverId} />;
    case 'roles': return <RoleEditor serverId={serverId} />;
    case 'channels': return <ChannelEditor serverId={serverId} />;
    case 'members': return <MemberManager serverId={serverId} />;
    case 'bans': return <BansTab serverId={serverId} />;
    case 'invites': return <InvitesTab serverId={serverId} />;
    case 'webhooks': return <WebhookManager serverId={serverId} />;
    case 'audit-log': return <AuditLogTab serverId={serverId} />;
    case 'danger': return <DangerZone serverId={serverId} />;
    default: return null;
  }
}

/** Legacy tab key mapping — the old 'overview' tab mapped to these new tabs */
const LEGACY_TAB_MAP: Record<string, Tab> = {
  overview: 'appearance',
};

export function ServerSettings() {
  const open = useUiStore((s) => s.activeModal === 'server-settings');
  const serverId = useUiStore((s) => s.activeServerId);
  const { allowedTabs } = usePermissions(serverId);
  const meta = useServerStore((s) => (serverId ? s.serverMeta.get(serverId) : undefined));
  const isOwner = !!(meta && meta.user_id && meta.admin_user_id === meta.user_id);

  const isManaged = meta?.hosting_mode === 'managed';

  const visibleTabs = useMemo(() => {
    let tabs: { key: Tab; label: string }[];
    if (allowedTabs === 'all') {
      tabs = ALL_TABS;
    } else {
      const allowed = (allowedTabs as string[]).flatMap((t) => {
        // Map legacy 'overview' to new tabs
        const mapped = LEGACY_TAB_MAP[t];
        if (mapped) return [mapped];
        return [t];
      });
      // Admins who see 'overview' should see appearance, configuration, discovery
      if ((allowedTabs as string[]).includes('overview')) {
        allowed.push('appearance', 'configuration', 'discovery');
      }
      const unique = [...new Set(allowed)];
      tabs = ALL_TABS.filter((tab) => unique.includes(tab.key));
    }
    if (!isOwner || isManaged) tabs = tabs.filter((tab) => tab.key !== 'danger');
    return tabs;
  }, [allowedTabs, isOwner, isManaged]);

  const defaultTab = visibleTabs[0]?.key ?? 'appearance';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      const first = visibleTabs[0];
      if (first) setActiveTab(first.key);
    }
  }, [visibleTabs, activeTab]);

  if (!open || !serverId || visibleTabs.length === 0) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) useUiStore.getState().closeModal();
  };

  const visibleKeys = new Set(visibleTabs.map((t) => t.key));

  return (
    <Modal open={open} onOpenChange={handleOpenChange} title="Server Settings" width="full" bodyClassName="!overflow-hidden !p-0">
      <div className="flex h-[50vh]">
        <nav className="min-w-40 shrink-0 border-r-2 border-primary p-5 overflow-y-auto">
          {TAB_SECTIONS.map((section) => {
            const sectionTabs = section.tabs.filter((t) => visibleKeys.has(t.key));
            if (sectionTabs.length === 0) return null;
            return (
              <div key={section.label} className="mb-3">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted px-3 py-1">
                  {section.label}
                </p>
                {sectionTabs.map((tab) => (
                  <Button
                    key={tab.key}
                    variant="ghost"
                    className={cn(
                      'block w-full rounded-md px-3 py-2 text-left text-sm h-auto justify-start font-normal',
                      activeTab === tab.key
                        ? 'bg-active text-primary'
                        : 'text-secondary hover:bg-hover hover:text-primary',
                    )}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">
          <TabPanel activeTab={activeTab} serverId={serverId} />
        </div>
      </div>
    </Modal>
  );
}
