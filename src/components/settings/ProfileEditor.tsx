import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useAuthStore } from '../../stores/auth.js';
import { connectionManager } from '../../services/connection-manager.js';
import { Avatar } from '../common/Avatar.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';

async function uploadAvatarFile(file: File): Promise<string> {
  const { centralUrl, token } = useAuthStore.getState();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${centralUrl}/upload/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error((err as { error?: string }).error ?? 'Upload failed');
  }

  const data = (await res.json()) as { avatar_url: string };
  return data.avatar_url;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounced username availability check
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
      }).catch(() => {
        setUsernameStatus('idle');
      });
    }, 400);

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [username, user?.username]);

  if (!user) return null;

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError('Avatar must be under 4 MB.');
      return;
    }

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

      // Upload avatar if a new file was selected
      if (avatarFile) {
        const avatarUrl = await uploadAvatarFile(avatarFile);
        setUser({ ...user, avatar_url: avatarUrl });
        setAvatarFile(null);
        setAvatarPreview(null);
      }

      // Update profile fields
      const updates: { username?: string; display_name?: string; bio?: string; custom_status?: string } = {};
      if (username !== (user.username ?? '')) updates.username = username;
      if (displayName !== (user.display_name ?? '')) updates.display_name = displayName;
      if (bio !== (user.bio ?? '')) updates.bio = bio;
      if (customStatus !== (user.custom_status ?? '')) updates.custom_status = customStatus;

      if (Object.keys(updates).length > 0) {
        const updated = await trpc.profile.update.mutate(updates);
        setUser({ ...user, ...updated });
      }

      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarSrc = avatarPreview ?? user.avatar_url ?? null;

  return (
    <div className="settings-section">
      <h2 className="settings-heading">Profile</h2>

      <form onSubmit={handleSubmit} className="settings-form">
        {error && <div className="settings-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}

        <div className="profile-avatar-section">
          <Avatar src={currentAvatarSrc} username={user.username} size={80} />
          <div className="profile-avatar-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Avatar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
            {avatarPreview && (
              <span className="profile-avatar-hint">New avatar selected</span>
            )}
          </div>
        </div>

        <label className="settings-label">
          Username
          <div className="settings-input-row">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={32}
              className={`settings-input ${usernameStatus === 'taken' ? 'input-error' : usernameStatus === 'available' ? 'input-success' : ''}`}
            />
            <input
              type="text"
              value={`#${user.discriminator ?? '0000'}`}
              disabled
              className="settings-input settings-discriminator"
            />
          </div>
          {usernameStatus === 'checking' && <span className="settings-hint">Checking availability...</span>}
          {usernameStatus === 'available' && <span className="settings-hint settings-hint-success">Username available! You'll keep #{user.discriminator}.</span>}
          {usernameStatus === 'taken' && <span className="settings-hint settings-hint-warn">#{user.discriminator} is taken for this name. A new tag will be assigned.</span>}
        </label>

        <label className="settings-label">
          Display Name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            placeholder={user.username}
            className="settings-input"
          />
        </label>

        <label className="settings-label">
          Bio
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={190}
            rows={3}
            placeholder="Tell us about yourself"
            className="settings-input settings-textarea"
          />
          <span className="settings-char-count">{bio.length}/190</span>
        </label>

        <label className="settings-label">
          Custom Status
          <input
            type="text"
            value={customStatus}
            onChange={(e) => setCustomStatus(e.target.value)}
            maxLength={128}
            placeholder="What are you up to?"
            className="settings-input"
          />
        </label>

        <div className="settings-actions">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <LoadingSpinner size={18} /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
