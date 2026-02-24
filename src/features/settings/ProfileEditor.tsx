import { useState, useEffect, useRef, type FormEvent } from 'react';

import { Button, Input, TextArea } from '@/ui';
import { useAuthStore } from '@/stores/auth';
import { connectionManager } from '@/services/connection-manager';

import { AvatarUpload } from './AvatarUpload';
import { BannerUpload } from './BannerUpload';

async function uploadFile(endpoint: 'avatar' | 'banner', file: File): Promise<string> {
  const { centralUrl, token } = useAuthStore.getState();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${centralUrl}/upload/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error((err as { error?: string }).error ?? 'Upload failed');
  }

  const key = endpoint === 'avatar' ? 'avatar_url' : 'banner_url';
  const data = (await res.json()) as Record<string, string>;
  return data[key]!;
}

export function ProfileEditor() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [customStatus, setCustomStatus] = useState(user?.custom_status ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const checkTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    if (!user || username.length < 2 || username.toLowerCase() === user.username) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    checkTimerRef.current = setTimeout(() => {
      const trpc = connectionManager.getCentralTrpc();
      if (!trpc) return;
      trpc.profile.checkUsername.query({ username }).then((res) => {
        setUsernameStatus(res.available ? 'available' : 'taken');
      }).catch(() => setUsernameStatus('idle'));
    }, 400);
    return () => { if (checkTimerRef.current) clearTimeout(checkTimerRef.current); };
  }, [username, user?.username, user]);

  if (!user) return null;

  const handleFileSelected = (file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const trpc = connectionManager.getCentralTrpc();
      if (!trpc) throw new Error('Not connected to central');
      // Track fields that servers care about for sync
      const serverSyncData: Record<string, unknown> = {};
      if (avatarFile) {
        const avatarUrl = await uploadFile('avatar', avatarFile);
        setUser({ ...user, avatar_url: avatarUrl });
        serverSyncData.avatar_url = avatarUrl;
        setAvatarFile(null);
        setAvatarPreview(null);
      }
      if (bannerFile) {
        const bannerUrl = await uploadFile('banner', bannerFile);
        setUser({ ...user, banner_url: bannerUrl });
        setBannerFile(null);
        setBannerPreview(null);
      }
      const updates: { username?: string; display_name?: string; bio?: string; custom_status?: string; banner_url?: string | null } = {};
      if (username !== (user.username ?? '')) updates.username = username;
      if (displayName !== (user.display_name ?? '')) updates.display_name = displayName;
      if (bio !== (user.bio ?? '')) updates.bio = bio;
      if (customStatus !== (user.custom_status ?? '')) updates.custom_status = customStatus;
      if (bannerRemoved) updates.banner_url = null;
      if (Object.keys(updates).length > 0) {
        const updated = await trpc.profile.update.mutate(updates);
        setUser({ ...user, ...updated });
        if (updated.username !== undefined) serverSyncData.username = updated.username;
        if (updated.discriminator !== undefined) serverSyncData.discriminator = updated.discriminator;
        if (updated.display_name !== undefined) serverSyncData.display_name = updated.display_name;
        if (updated.avatar_url !== undefined) serverSyncData.avatar_url = updated.avatar_url;
      }
      // Sync profile changes to all connected servers (fire-and-forget)
      if (Object.keys(serverSyncData).length > 0) {
        const connections = connectionManager.getAllConnections();
        if (connections.length > 0) {
          Promise.allSettled(
            connections.map((conn) => conn.trpc.members.syncProfile.mutate(serverSyncData)),
          );
        }
      }
      setBannerRemoved(false);
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarSrc = avatarPreview ?? user.avatar_url ?? null;
  const usernameHint = usernameStatus === 'checking' ? 'Checking availability...'
    : usernameStatus === 'available' ? `Username available! You'll keep #${user.discriminator}.`
    : usernameStatus === 'taken' ? `#${user.discriminator} is taken for this name. A new tag will be assigned.`
    : undefined;
  const usernameError = usernameStatus === 'taken' ? ' ' : undefined;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}
        <AvatarUpload
          currentSrc={currentAvatarSrc}
          username={user.username}
          onFileSelected={handleFileSelected}
          previewActive={!!avatarPreview}
          onError={setError}
        />
        <BannerUpload
          currentSrc={bannerRemoved ? null : (user.banner_url ?? null)}
          previewSrc={bannerPreview}
          onFileReady={(file) => {
            setBannerFile(file);
            setBannerRemoved(false);
            const reader = new FileReader();
            reader.onload = () => setBannerPreview(reader.result as string);
            reader.readAsDataURL(file);
          }}
          onRemove={() => {
            setBannerFile(null);
            setBannerPreview(null);
            setBannerRemoved(true);
          }}
          onError={setError}
        />
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={32}
              error={usernameError}
            />
          </div>
          <Input value={`#${user.discriminator ?? '0000'}`} disabled className="w-24" />
        </div>
        {usernameHint && (
          <p className={`text-xs ${usernameStatus === 'taken' ? 'text-warning' : usernameStatus === 'available' ? 'text-success' : 'text-muted'}`}>
            {usernameHint}
          </p>
        )}
        <Input label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} placeholder={user.username} />
        <div>
          <TextArea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={190} placeholder="Tell us about yourself" />
          <span className="text-xs text-muted">{bio.length}/190</span>
        </div>
        <Input label="Custom Status" value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} maxLength={128} placeholder="What are you up to?" />
        {user.has_google && (
          <div className="flex items-center gap-2 text-sm text-muted rounded-md bg-surface-2 px-3 py-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Linked to Google
          </div>
        )}
        <Button type="submit" loading={saving}>Save Changes</Button>
      </form>
    </div>
  );
}
