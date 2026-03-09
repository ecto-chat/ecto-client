import { useState, useRef, useMemo, useEffect, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, Lock, Upload, X } from 'lucide-react';
import type { NewsPost } from 'ecto-shared';
import { connectionManager } from 'ecto-core';
import { cssUrl } from '@/lib/css-utils';
import { Button, Input, IconButton, Modal } from '@/ui';
import { ScrollArea } from '@/ui/ScrollArea';

interface NewsPostFormProps {
  serverId: string;
  channelId: string;
  post?: NewsPost;
  discoverable?: boolean;
  discoveryApproved?: boolean;
  onDone: () => void;
}

function getDiscoveryErrors(
  title: string,
  subtitle: string,
  heroImageUrl: string,
  heroDimensions: { width: number; height: number } | null,
): string[] {
  const errors: string[] = [];
  const t = title.trim().length;
  if (t < 30) errors.push(`Title too short (${t}/30 min characters)`);
  if (t > 60) errors.push(`Title too long (${t}/60 max characters)`);
  const s = subtitle.trim().length;
  if (s < 60) errors.push(`Subtitle too short (${s}/60 min characters)`);
  if (s > 120) errors.push(`Subtitle too long (${s}/120 max characters)`);
  if (!heroImageUrl.trim()) {
    errors.push('No hero image provided');
  } else if (heroDimensions && (heroDimensions.width < 1280 || heroDimensions.height < 720)) {
    errors.push(`Hero image too small (${heroDimensions.width}x${heroDimensions.height}, min 1280x720)`);
  }
  return errors;
}

export function NewsPostForm({ serverId, channelId, post, discoverable, discoveryApproved, onDone }: NewsPostFormProps) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [subtitle, setSubtitle] = useState(post?.subtitle ?? '');
  const [heroImageUrl, setHeroImageUrl] = useState(post?.hero_image_url ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [submitToDiscovery, setSubmitToDiscovery] = useState(
    (discoverable && discoveryApproved) ? (post?.submitted_to_discovery ?? false) : false,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [heroDimensions, setHeroDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!post;
  const isLockedByDiscovery = isEditing && post.submitted_to_discovery;

  // Measure dimensions of existing hero image on mount
  useEffect(() => {
    if (!heroImageUrl) { setHeroDimensions(null); return; }
    const img = new Image();
    img.onload = () => setHeroDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => setHeroDimensions(null);
    img.src = heroImageUrl;
  }, [heroImageUrl]);

  const discoveryErrors = useMemo(
    () => submitToDiscovery ? getDiscoveryErrors(title, subtitle, heroImageUrl, heroDimensions) : [],
    [submitToDiscovery, title, subtitle, heroImageUrl, heroDimensions],
  );

  const handleHeroUpload = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const conn = connectionManager.getServerConnection(serverId);
      if (!conn) throw new Error('Not connected');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${conn.address}/upload/news-hero/${channelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${conn.token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error((data as { error?: string }).error ?? 'Upload failed');
      }
      const data = (await res.json()) as { hero_url: string };
      // Measure dimensions from the local file
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setHeroDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => URL.revokeObjectURL(objectUrl);
      img.src = objectUrl;
      setHeroImageUrl(data.hero_url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload hero image');
    } finally {
      setUploading(false);
    }
  };

  const handleDiscoveryToggle = (checked: boolean) => {
    if (checked) {
      setShowDiscoveryModal(true);
    } else {
      setSubmitToDiscovery(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const trpc = connectionManager.getServerTrpc(serverId);
    if (!trpc) return;

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        if (isLockedByDiscovery) {
          // Only allow retracting — no content changes
          await trpc.news.updatePost.mutate({
            post_id: post.id,
            submit_to_discovery: submitToDiscovery,
          });
        } else {
          await trpc.news.updatePost.mutate({
            post_id: post.id,
            title: title.trim(),
            subtitle: subtitle.trim() || undefined,
            hero_image_url: heroImageUrl.trim() || undefined,
            content: content.trim(),
            submit_to_discovery: submitToDiscovery,
          });
        }
      } else {
        await trpc.news.createPost.mutate({
          channel_id: channelId,
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          hero_image_url: heroImageUrl.trim() || undefined,
          content: content.trim(),
          submit_to_discovery: submitToDiscovery,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b-2 border-primary px-4">
        <IconButton variant="ghost" size="sm" onClick={onDone}>
          <ArrowLeft size={18} />
        </IconButton>
        <span className="text-sm font-semibold text-primary">
          {isEditing ? 'Edit Post' : 'New Post'}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <form onSubmit={handleSubmit} className="max-w-[720px] mx-auto p-6 space-y-4">
          {error && <p className="text-sm text-danger">{error}</p>}

          {isLockedByDiscovery && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-2">
              <Lock size={14} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-500">
                This post is live on Ecto Discover. Retract it to make edits.
              </p>
            </div>
          )}

          {discoveryErrors.length > 0 && (
            <div className="rounded-md border border-danger/30 bg-danger/10 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-danger">
                <AlertCircle size={14} />
                Discovery Validation Errors
              </div>
              {discoveryErrors.map((err, i) => (
                <p key={i} className="text-xs text-danger/80 pl-5">{err}</p>
              ))}
            </div>
          )}

          <Input
            label="Title"
            placeholder="Post title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            disabled={isLockedByDiscovery}
          />

          <Input
            label="Subtitle (optional)"
            placeholder="Brief description"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={500}
            disabled={isLockedByDiscovery}
          />

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Hero Image (optional)</label>
            {heroImageUrl ? (
              <div className="relative">
                <div
                  className="w-full h-48 rounded-lg bg-cover bg-center border border-primary"
                  style={{ backgroundImage: cssUrl(heroImageUrl) }}
                />
                {!isLockedByDiscovery && (
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    onClick={() => { setHeroImageUrl(''); setHeroDimensions(null); }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="w-full h-32 rounded-lg border-2 border-dashed border-primary flex flex-col items-center justify-center gap-2 text-muted hover:border-accent hover:text-accent transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isLockedByDiscovery}
              >
                <Upload size={20} />
                <span className="text-xs">{uploading ? 'Uploading...' : 'Click to upload hero image'}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleHeroUpload(file);
                e.target.value = '';
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Content (Markdown)</label>
            <textarea
              className="w-full h-64 p-3 bg-primary text-primary text-sm rounded-md border border-primary resize-y focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              placeholder="Write your post content in Markdown..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={100_000}
              required
              disabled={isLockedByDiscovery}
            />
          </div>

          {discoverable && discoveryApproved && (
            <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={submitToDiscovery}
                onChange={(e) => handleDiscoveryToggle(e.target.checked)}
                className="accent-accent"
              />
              Submit to Ecto Discover
            </label>
          )}
          {discoverable && !discoveryApproved && (
            <p className="text-sm text-muted">Discovery pending approval</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
              Cancel
            </Button>
            {isLockedByDiscovery ? (
              <Button
                type="submit"
                variant="primary"
                disabled={saving || submitToDiscovery}
              >
                {saving ? 'Saving...' : submitToDiscovery ? 'Locked' : 'Retract & Save'}
              </Button>
            ) : (
              <Button type="submit" variant="primary" disabled={saving || !title.trim() || !content.trim() || discoveryErrors.length > 0}>
                {saving ? 'Saving...' : isEditing ? 'Update Post' : 'Publish Post'}
              </Button>
            )}
          </div>
        </form>
      </ScrollArea>

      <Modal
        open={showDiscoveryModal}
        onOpenChange={(v) => { if (!v) setShowDiscoveryModal(false); }}
        title="Submit to Ecto Discover"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Submitting this post to Ecto Discover will make it visible in the global discovery feed
            across all Ecto clients. An admin may review and feature your post.
          </p>
          <p className="text-sm text-secondary">
            You can retract your post from discovery at any time by unchecking this option and updating.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowDiscoveryModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setSubmitToDiscovery(true);
                setShowDiscoveryModal(false);
              }}
            >
              Submit to Discover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
