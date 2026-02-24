import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  label?: string;
  error?: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function Select({
  label,
  error,
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  className,
  disabled,
}: SelectProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-secondary">{label}</label>}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md bg-secondary border-2 border-primary',
            'px-3 text-sm text-primary placeholder:text-muted',
            'focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-primary-active',
            'transition-colors duration-150',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'ring-1 ring-danger/40 border-danger/40',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="size-4 text-muted" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(
              'relative z-[200] min-w-[8rem] overflow-hidden rounded-lg bg-surface border-2 border-primary shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            )}
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2',
                    'text-sm text-primary outline-none',
                    'hover:bg-hover focus:bg-hover',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                >
                  <span className="absolute left-2 flex size-4 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="size-4 text-accent" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
