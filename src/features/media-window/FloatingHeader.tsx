import { Maximize2 } from 'lucide-react';

import { IconButton } from '@/ui';

import { useExpandMedia } from './useExpandMedia';

type FloatingHeaderProps = {
  title: string;
};

export function FloatingHeader({ title }: FloatingHeaderProps) {
  const expandMedia = useExpandMedia();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing">
      <div className="mx-auto h-1 w-8 rounded-full bg-white/20" />
      <span className="absolute left-3 text-xs font-medium text-white/80 truncate max-w-[200px]">
        {title}
      </span>
      <IconButton
        size="sm"
        variant="ghost"
        tooltip="Expand"
        onClick={(e) => {
          e.stopPropagation();
          expandMedia();
        }}
        className="absolute right-1.5 top-1 text-white/70 hover:text-white hover:bg-white/10"
      >
        <Maximize2 className="size-3.5" />
      </IconButton>
    </div>
  );
}
