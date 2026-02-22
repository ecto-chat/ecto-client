import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';

import { Button, Modal, ScrollArea } from '@/ui';

import { useUiStore } from '@/stores/ui';
import { useServerStore } from '@/stores/server';

import { usePermissions } from '@/hooks/usePermissions';

import { cn } from '@/lib/cn';

import { GeneralSettings } from './GeneralSettings';
import { BansTab } from './SecuritySettings';
import { DangerZone } from './DangerZone';
import { InvitesTab } from './InvitesTab';
import { AuditLogTab } from './AuditLogTab';
import { RoleEditor } from './RoleEditor';
import { ChannelEditor } from './ChannelEditor';
import { MemberManager } from './MemberManager';
import { WebhookManager } from './WebhookManager';

type Tab = 'overview' | 'roles' | 'channels' | 'members' | 'bans' | 'invites' | 'webhooks' | 'audit-log' | 'danger';

const ALL_TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'roles', label: 'Roles' },
  { key: 'channels', label: 'Channels' },
  { key: 'members', label: 'Members' },
  { key: 'bans', label: 'Bans' },
  { key: 'invites', label: 'Invites' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'audit-log', label: 'Audit Log' },
  { key: 'danger', label: 'Danger Zone' },
];

function TabPanel({ activeTab, serverId }: { activeTab: Tab; serverId: string }) {
  switch (activeTab) {
    case 'overview': return <GeneralSettings serverId={serverId} />;
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

function AnimatedTabContent({ activeTab, serverId }: { activeTab: Tab; serverId: string }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className="flex-1 overflow-hidden"
      animate={{ height }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div ref={innerRef}>
        <TabPanel activeTab={activeTab} serverId={serverId} />
      </div>
    </motion.div>
  );
}

export function ServerSettings() {
  const open = useUiStore((s) => s.activeModal === 'server-settings');
  const serverId = useUiStore((s) => s.activeServerId);
  const { allowedTabs } = usePermissions(serverId);
  const meta = useServerStore((s) => (serverId ? s.serverMeta.get(serverId) : undefined));
  const isOwner = !!(meta && meta.user_id && meta.admin_user_id === meta.user_id);

  const isManaged = meta?.hosting_mode === 'managed';

  const visibleTabs = useMemo(() => {
    let tabs = allowedTabs === 'all'
      ? ALL_TABS
      : ALL_TABS.filter((tab) => (allowedTabs as string[]).includes(tab.key));
    if (!isOwner || isManaged) tabs = tabs.filter((tab) => tab.key !== 'danger');
    return tabs;
  }, [allowedTabs, isOwner, isManaged]);

  const defaultTab = visibleTabs[0]?.key ?? 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0]!.key);
    }
  }, [visibleTabs, activeTab]);

  if (!open || !serverId || visibleTabs.length === 0) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) useUiStore.getState().closeModal();
  };

  return (
    <Modal open={open} onOpenChange={handleOpenChange} title="Server Settings" width="full">
      <div className="flex gap-6">
        <nav className="min-w-40 border-r border-border pr-4">
          <ScrollArea className="max-h-[30rem]">
            {visibleTabs.map((tab) => (
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
          </ScrollArea>
        </nav>

        <AnimatedTabContent activeTab={activeTab} serverId={serverId} />
      </div>
    </Modal>
  );
}
