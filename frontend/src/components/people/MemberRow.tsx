// One person on a trip: square avatar, name (and "you"), email, and their role. The owner sees a role picker
// and Remove on everyone else's row; everyone else sees a role chip. Errors from a role change or removal
// show on the row they belong to.
import type { Member } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSquare } from '@/components/shell/UserSquare';
import { cn } from '@/lib/utils';
import { ROLE_LABEL, type MemberRole } from '@/components/people/peopleCopy';

export interface MemberRowProps {
  member: Member;
  isYou: boolean;
  /** The viewer owns the trip and this row isn't the owner's. */
  manageable: boolean;
  busy?: boolean;
  error?: string | null;
  onRoleChange?: (role: MemberRole) => void;
  onRemove?: () => void;
}

export function RoleChip({ role }: { role: Member['role'] }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-sm border px-1.5 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.08em]',
        role === 'owner' ? 'border-ink text-ink' : 'border-rule-strong text-ink-2',
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

export function MemberRow({ member, isYou, manageable, busy, error, onRoleChange, onRemove }: MemberRowProps) {
  return (
    <li className="border-b border-rule py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <UserSquare user={member} size={40} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="type-body truncate font-medium text-ink">
            {member.name}
            {isYou ? <span className="font-normal text-ink-2"> (you)</span> : null}
          </p>
          <p className="truncate font-mono text-[13px] leading-5 text-ink-2">{member.email}</p>
        </div>
        {manageable ? null : (
          <div className="pt-1">
            <RoleChip role={member.role} />
          </div>
        )}
      </div>

      {manageable && member.role !== 'owner' ? (
        <div className="mt-2 flex items-center gap-2 pl-[52px]">
          <Select value={member.role} onValueChange={(v) => onRoleChange?.(v as MemberRole)} disabled={busy}>
            <SelectTrigger aria-label={`Role for ${member.name}`} className="h-11 w-[132px] text-[15px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            className="px-3 text-stamp"
            disabled={busy}
            onClick={onRemove}
            aria-label={`Remove ${member.name}`}
          >
            Remove
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="type-body-s mt-2 pl-[52px] text-stamp">
          {error}
        </p>
      ) : null}
    </li>
  );
}
