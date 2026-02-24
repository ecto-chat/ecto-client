import { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

type SearchSelectOption = {
  value: string;
  label: string;
};

type SearchSelectProps = {
  label?: string;
  error?: string;
  options: SearchSelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
};

export function SearchSelect({
  label,
  error,
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  className,
  disabled,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selectedLabel = options.find((o) => o.value === value)?.label;

  useEffect(() => {
    if (open) {
      setQuery('');
      // Focus input after popover opens
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-secondary">{label}</label>}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md bg-secondary border-2 border-primary',
            'px-3 text-sm text-primary',
            'focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-primary-active',
            'transition-colors duration-150',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'ring-1 ring-danger/40 border-danger/40',
            className,
          )}
        >
          <span className={cn(!selectedLabel && 'text-muted')}>
            {selectedLabel ?? placeholder}
          </span>
          <ChevronDown className="size-4 text-muted" />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-[200] w-[var(--radix-popover-trigger-width)] rounded-lg bg-surface border-2 border-primary shadow-lg overflow-hidden"
            sideOffset={4}
            align="start"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-primary">
              <Search className="size-4 text-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No results found</p>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2',
                      'text-sm text-primary outline-none',
                      'hover:bg-hover focus:bg-hover',
                    )}
                    onClick={() => {
                      onValueChange?.(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="absolute left-2 flex size-4 items-center justify-center">
                      {value === option.value && <Check className="size-4 text-accent" />}
                    </span>
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
