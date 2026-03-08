import { useState, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function TagInput({ tags, onChange, label, placeholder = 'Add a tag...', className, disabled }: TagInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || tag.length > MAX_TAG_LENGTH) return;
    if (tags.includes(tag) || tags.length >= MAX_TAGS) return;
    onChange([...tags, tag]);
    setValue('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(value);
    } else if (e.key === 'Backspace' && !value && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleChange = (raw: string) => {
    // If comma typed mid-string, split and add
    if (raw.includes(',')) {
      const parts = raw.split(',');
      for (const part of parts.slice(0, -1)) {
        addTag(part);
      }
      setValue(parts[parts.length - 1] ?? '');
      return;
    }
    setValue(raw);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <label className="text-sm font-medium text-secondary">{label}</label>}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-md bg-secondary border-2 border-primary px-2.5 py-1.5',
          'focus-within:ring-1 focus-within:ring-accent/40 focus-within:border-primary-active',
          'transition-colors duration-150 cursor-text',
          disabled && 'opacity-50 pointer-events-none',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-accent/15 text-accent px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              className="rounded-sm hover:bg-accent/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (value.trim()) addTag(value); }}
            placeholder={tags.length === 0 ? placeholder : ''}
            maxLength={MAX_TAG_LENGTH}
            className="flex-1 min-w-[80px] bg-transparent text-sm text-primary placeholder:text-muted outline-none py-0.5"
          />
        )}
      </div>
      <p className="text-xs text-muted">{tags.length}/{MAX_TAGS} tags. Separate with comma or Enter.</p>
    </div>
  );
}
