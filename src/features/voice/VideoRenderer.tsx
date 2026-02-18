import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

type VideoRendererProps = {
  stream: MediaStream;
  className?: string;
};

export function VideoRenderer({ stream, className }: VideoRendererProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn('h-full w-full rounded-lg object-cover', className)}
    />
  );
}
