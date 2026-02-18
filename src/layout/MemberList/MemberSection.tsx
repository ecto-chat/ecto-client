import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { MemberItem } from './MemberItem';
import type { Member, Role } from 'ecto-shared';

type MemberSectionProps = {
  title: string;
  count: number;
  members: Member[];
  rolesMap?: Map<string, Role>;
  isFirst?: boolean;
  indexOffset?: number;
};

export function MemberSection({ title, count, members, rolesMap, isFirst, indexOffset = 0 }: MemberSectionProps) {
  return (
    <div>
      <h3
        className={cn(
          'px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted',
          isFirst ? 'pt-0' : 'pt-3',
        )}
      >
        {title} — {count}
      </h3>
      {members.map((member, i) => (
        <motion.div
          key={member.user_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (indexOffset + i) * 0.04 + 0.02, duration: 0.2 }}
        >
          <MemberItem member={member} rolesMap={rolesMap} />
        </motion.div>
      ))}
    </div>
  );
}
