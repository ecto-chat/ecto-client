import { motion } from 'motion/react';
import {
  Gamepad2,
  BookOpen,
  Globe,
  Briefcase,
  Palette,
  Users,
  Plus,
} from 'lucide-react';

import { cn } from '@/lib/cn';

import type { ServerTemplate } from '@/lib/server-templates';
import { SERVER_TEMPLATES } from '@/lib/server-templates';

type TemplateStepProps = {
  onSelectTemplate: (template: ServerTemplate | null) => void;
};

const TEMPLATE_ICONS: Record<string, typeof Gamepad2> = {
  gaming: Gamepad2,
  study: BookOpen,
  community: Globe,
  team: Briefcase,
  creator: Palette,
  friends: Users,
};

export function TemplateStep({ onSelectTemplate }: TemplateStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h2 className="text-xl text-primary">Choose a Template</h2>
        <p className="text-sm text-secondary">
          Pick a template to pre-fill channels, or start from scratch.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {SERVER_TEMPLATES.map((tpl) => {
          const Icon = TEMPLATE_ICONS[tpl.id] ?? Globe;
          return (
            <motion.button
              key={tpl.id}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg p-4',
                'bg-tertiary border border-border',
                'hover:border-accent/40 hover:bg-hover',
                'transition-colors duration-150 cursor-pointer text-center',
              )}
              onClick={() => onSelectTemplate(tpl)}
            >
              <Icon size={24} className="text-accent" />
              <span className="text-sm text-primary">{tpl.name}</span>
              <span className="text-xs text-muted leading-tight">{tpl.description}</span>
            </motion.button>
          );
        })}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg p-4',
            'bg-tertiary border border-dashed border-border',
            'hover:border-accent/40 hover:bg-hover',
            'transition-colors duration-150 cursor-pointer text-center',
          )}
          onClick={() => onSelectTemplate(null)}
        >
          <Plus size={24} className="text-muted" />
          <span className="text-sm text-primary">Start from Scratch</span>
          <span className="text-xs text-muted leading-tight">Create your own channels</span>
        </motion.button>
      </div>
    </div>
  );
}
