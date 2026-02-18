import { CornerDownRight } from 'lucide-react';

type ReplyReferenceProps = {
  replyTo: string;
};

export function ReplyReference({ replyTo: _replyTo }: ReplyReferenceProps) {
  return (
    <div className="flex items-center gap-1 mb-0.5">
      <CornerDownRight size={14} className="text-muted shrink-0" />
      <span className="text-xs text-muted">replying to a message</span>
    </div>
  );
}
