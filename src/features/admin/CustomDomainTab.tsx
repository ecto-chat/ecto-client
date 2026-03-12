import { useState, useEffect, useRef, useCallback } from 'react';

import { Globe, Copy, Check, RefreshCw, Trash2, AlertCircle } from 'lucide-react';

import { Button, Input, Spinner } from '@/ui';

import { cn } from '@/lib/cn';

import { connectionManager, useServerStore } from 'ecto-core';

type DomainStatus = 'pending' | 'dns_verified' | 'active' | 'failed';

type DomainRecord = {
  type: string;
  name: string;
  value: string;
};

type DomainInfo = {
  domain: string;
  status: DomainStatus;
  created_at: string;
  dns_records: DomainRecord[];
};

type CustomDomainTabProps = {
  serverId: string;
};

function isValidDomain(domain: string): string | null {
  const trimmed = domain.trim();
  if (!trimmed) return 'Domain is required';
  if (!trimmed.includes('.')) return 'Domain must contain at least one dot';
  if (trimmed.endsWith('.ecto.chat')) return 'Cannot use an ecto.chat subdomain';
  // IP address check (simple v4)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return 'Cannot use an IP address';
  return null;
}

const STATUS_CONFIG: Record<DomainStatus, { color: string; label: string; dotClass: string }> = {
  pending: { color: 'text-yellow-400', label: 'Awaiting DNS verification', dotClass: 'bg-yellow-400' },
  dns_verified: { color: 'text-blue-400', label: 'Provisioning TLS...', dotClass: 'bg-blue-400' },
  active: { color: 'text-green-400', label: 'Active', dotClass: 'bg-green-400' },
  failed: { color: 'text-red-400', label: 'DNS verification failed', dotClass: 'bg-red-400' },
};

export function CustomDomainTab({ serverId }: CustomDomainTabProps) {
  const [domainInfo, setDomainInfo] = useState<DomainInfo | null | undefined>(undefined); // undefined = loading
  const [domainInput, setDomainInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dnsTab, setDnsTab] = useState<'subdomain' | 'domain'>('subdomain');
  const [instructionCopied, setInstructionCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const meta = useServerStore((s) => s.serverMeta.get(serverId));
  const isManaged = meta?.hosting_mode === 'managed';

  const fetchDomain = useCallback(async () => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;
    try {
      const result = await centralTrpc.customDomains.get.query({ server_id: serverId });
      setDomainInfo(result && result.domain ? (result as DomainInfo) : null);
    } catch {
      setDomainInfo(null);
    }
  }, [serverId]);

  useEffect(() => {
    void fetchDomain();
  }, [fetchDomain]);

  // Auto-refresh while pending or dns_verified
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (domainInfo && (domainInfo.status === 'pending' || domainInfo.status === 'dns_verified')) {
      intervalRef.current = setInterval(() => {
        void fetchDomain();
      }, 30_000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [domainInfo?.status, fetchDomain]);

  const handleSave = async () => {
    const trimmed = domainInput.trim();
    const validationError = isValidDomain(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    setSaving(true);
    setError('');
    try {
      const result = await centralTrpc.customDomains.add.mutate({ server_id: serverId, domain: trimmed });
      setDomainInfo(result as DomainInfo);
      setDomainInput('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save domain');
    } finally {
      setSaving(false);
    }
  };

  const handleCheck = async () => {
    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    setChecking(true);
    setError('');
    try {
      const result = await centralTrpc.customDomains.verify.mutate({ server_id: serverId });
      setDomainInfo((prev) => prev ? { ...prev, status: result.status as DomainStatus } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }

    const centralTrpc = connectionManager.getCentralTrpc();
    if (!centralTrpc) return;

    setRemoving(true);
    setError('');
    try {
      await centralTrpc.customDomains.remove.mutate({ server_id: serverId });
      setDomainInfo(null);
      setConfirmRemove(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove domain');
    } finally {
      setRemoving(false);
    }
  };

  const handleCopyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // fallback omitted
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isManaged) return null;

  // Loading state
  if (domainInfo === undefined) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const hasDomain = domainInfo && domainInfo.domain;
  const statusCfg = hasDomain ? STATUS_CONFIG[domainInfo.status] : null;
  const showDnsInstructions = hasDomain && (domainInfo.status === 'pending' || domainInfo.status === 'failed');
  const showCheckButton = hasDomain && (domainInfo.status === 'pending' || domainInfo.status === 'failed');

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Custom Domain</h2>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* No domain configured — show instructions + input form */}
      {!hasDomain && (
        <div className="space-y-4">
          {/* How it works card */}
          <div className="rounded-lg bg-tertiary p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-primary">How it works</h3>
              <p className="text-xs text-muted mt-1">
                Point your own domain to this server. We handle TLS certificates automatically.
              </p>
            </div>

            <ol className="space-y-2 text-sm text-muted">
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-active text-xs font-semibold text-primary">1</span>
                <span>Enter your domain below and save</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-active text-xs font-semibold text-primary">2</span>
                <span>Add the DNS record shown below at your DNS provider</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-active text-xs font-semibold text-primary">3</span>
                <span>We verify DNS and provision a TLS certificate automatically</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-active text-xs font-semibold text-primary">4</span>
                <span>Your server is live at your custom domain with HTTPS</span>
              </li>
            </ol>

            {/* DNS instruction tabs */}
            <div className="rounded-lg bg-secondary overflow-hidden">
              <div className="flex">
                <button
                  className={cn(
                    'flex-1 px-4 py-2.5 text-xs font-medium transition-colors',
                    dnsTab === 'subdomain'
                      ? 'bg-primary text-primary'
                      : 'bg-secondary text-muted hover:text-secondary',
                  )}
                  onClick={() => setDnsTab('subdomain')}
                >
                  Subdomain
                  <span className="ml-1.5 text-[10px] text-muted">(chat.example.com)</span>
                </button>
                <button
                  className={cn(
                    'flex-1 px-4 py-2.5 text-xs font-medium transition-colors',
                    dnsTab === 'domain'
                      ? 'bg-primary text-primary'
                      : 'bg-secondary text-muted hover:text-secondary',
                  )}
                  onClick={() => setDnsTab('domain')}
                >
                  Root Domain
                  <span className="ml-1.5 text-[10px] text-muted">(example.com)</span>
                </button>
              </div>

              <div className="bg-primary p-4 space-y-3">
                {dnsTab === 'subdomain' ? (
                  <>
                    <p className="text-xs text-muted">Add a <strong className="text-primary">CNAME</strong> record at your DNS provider:</p>
                    <div className="grid grid-cols-[60px_1fr] gap-y-2 text-sm">
                      <span className="text-muted text-xs uppercase tracking-wide">Type</span>
                      <code className="text-primary font-mono text-xs">CNAME</code>
                      <span className="text-muted text-xs uppercase tracking-wide">Name</span>
                      <code className="text-primary font-mono text-xs">chat</code>
                      <span className="text-muted text-xs uppercase tracking-wide">Value</span>
                      <div className="flex items-center gap-2">
                        <code className="text-primary font-mono text-xs">gateway.ecto.chat</code>
                        <button
                          className="text-muted hover:text-primary transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText('gateway.ecto.chat').catch(() => {});
                            setInstructionCopied(true);
                            setTimeout(() => setInstructionCopied(false), 2000);
                          }}
                        >
                          {instructionCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted">
                      Replace <code className="text-primary">chat</code> with your subdomain prefix (e.g. <code className="text-primary">community</code>, <code className="text-primary">server</code>).
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted">Add an <strong className="text-primary">A</strong> record at your DNS provider:</p>
                    <div className="grid grid-cols-[60px_1fr] gap-y-2 text-sm">
                      <span className="text-muted text-xs uppercase tracking-wide">Type</span>
                      <code className="text-primary font-mono text-xs">A</code>
                      <span className="text-muted text-xs uppercase tracking-wide">Name</span>
                      <code className="text-primary font-mono text-xs">@</code>
                      <span className="text-muted text-xs uppercase tracking-wide">Value</span>
                      <div className="flex items-center gap-2">
                        <code className="text-primary font-mono text-xs">46.225.178.63</code>
                        <button
                          className="text-muted hover:text-primary transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText('46.225.178.63').catch(() => {});
                            setInstructionCopied(true);
                            setTimeout(() => setInstructionCopied(false), 2000);
                          }}
                        >
                          {instructionCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted">
                      Some DNS providers use <code className="text-primary">@</code> for the root domain. Others require leaving the name field blank or entering your full domain.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-yellow-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>If using Cloudflare, set the proxy status to <strong>DNS only</strong> (grey cloud) so TLS can be provisioned directly.</span>
            </div>
          </div>

          {/* Domain input */}
          <div className="rounded-lg bg-tertiary p-4 space-y-3">
            <div className="flex gap-3 items-end">
              <Input
                label="Domain"
                placeholder={dnsTab === 'subdomain' ? 'chat.example.com' : 'example.com'}
                value={domainInput}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  setError('');
                }}
              />
              <Button loading={saving} onClick={handleSave}>
                <Globe size={14} /> Save Domain
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Domain is configured — show status */}
      {hasDomain && (
        <>
          <div className="rounded-lg bg-tertiary p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-muted">Domain</p>
                <code className="text-sm text-primary">{domainInfo.domain}</code>
              </div>
              {statusCfg && (
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${statusCfg.dotClass}`} />
                  <span className={`text-sm ${statusCfg.color}`}>{statusCfg.label}</span>
                </div>
              )}
            </div>

            {/* DNS instructions */}
            {showDnsInstructions && (() => {
              const isRootDomain = domainInfo.domain.split('.').length === 2;
              return (
                <div className="rounded-md bg-secondary p-3 space-y-2">
                  <p className="text-sm font-medium text-primary">DNS Setup Instructions</p>
                  <p className="text-xs text-muted">Add this record at your DNS provider:</p>
                  <div className="grid grid-cols-[60px_1fr] gap-y-2 text-sm">
                    <span className="text-muted text-xs uppercase tracking-wide">Type</span>
                    <code className="text-primary font-mono text-xs">{isRootDomain ? 'A' : 'CNAME'}</code>
                    <span className="text-muted text-xs uppercase tracking-wide">Name</span>
                    <code className="text-primary font-mono text-xs">{isRootDomain ? '@' : domainInfo.domain}</code>
                    <span className="text-muted text-xs uppercase tracking-wide">Value</span>
                    <div className="flex items-center gap-2">
                      <code className="text-primary font-mono text-xs">{isRootDomain ? '46.225.178.63' : 'gateway.ecto.chat'}</code>
                      <button
                        className="text-muted hover:text-primary transition-colors"
                        onClick={() => handleCopyValue(isRootDomain ? '46.225.178.63' : 'gateway.ecto.chat')}
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-400 mt-2">
                    If using Cloudflare, set the proxy status to <strong>DNS only</strong> (grey cloud).
                  </p>
                </div>
              );
            })()}

            {/* Action buttons */}
            <div className="flex gap-2">
              {showCheckButton && (
                <Button variant="secondary" size="sm" loading={checking} onClick={handleCheck}>
                  <RefreshCw size={14} /> Check Now
                </Button>
              )}
              {confirmRemove ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">Are you sure?</span>
                  <Button variant="danger" size="sm" loading={removing} onClick={handleRemove}>
                    Confirm Remove
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={handleRemove}>
                  <Trash2 size={14} /> Remove Domain
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
