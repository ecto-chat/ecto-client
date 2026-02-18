import { Hash, Volume2 } from 'lucide-react';

import type { ServerTemplate } from '@/lib/server-templates';

type TemplatePreviewProps = {
  template: ServerTemplate;
};

export function TemplatePreview({ template }: TemplatePreviewProps) {
  return (
    <div className="flex flex-col gap-4">
      {template.categories.map((cat) => (
        <div key={cat.name}>
          <div className="mb-1.5 text-xs uppercase tracking-wider font-semibold text-muted">
            {cat.name}
          </div>
          {cat.channels.map((ch) => (
            <ChannelRow key={ch.name} name={ch.name} type={ch.type} />
          ))}
        </div>
      ))}
      {template.uncategorized.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider font-semibold text-muted">
            Uncategorized
          </div>
          {template.uncategorized.map((ch) => (
            <ChannelRow key={ch.name} name={ch.name} type={ch.type} />
          ))}
        </div>
      )}
      {template.roles.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider font-semibold text-muted">
            Roles
          </div>
          {template.roles.map((role) => (
            <div key={role.name} className="flex items-center gap-2 py-1 pl-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: role.color }}
              />
              <span className="text-sm text-secondary">{role.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelRow({ name, type }: { name: string; type: 'text' | 'voice' }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-2">
      {type === 'text' ? (
        <Hash size={14} className="shrink-0 text-muted" />
      ) : (
        <Volume2 size={14} className="shrink-0 text-muted" />
      )}
      <span className="text-sm text-secondary">{name}</span>
    </div>
  );
}
