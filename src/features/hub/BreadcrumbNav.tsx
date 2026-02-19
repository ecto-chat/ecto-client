import { ChevronRight } from 'lucide-react';

type BreadcrumbNavProps = {
  breadcrumb: { id: string | null; name: string }[];
  onNavigate: (index: number) => void;
};

export function BreadcrumbNav({ breadcrumb, onNavigate }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted overflow-x-auto">
      {breadcrumb.map((item, i) => (
        <span key={item.id ?? 'root'} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="flex-shrink-0" />}
          {i < breadcrumb.length - 1 ? (
            <button
              type="button"
              className="hover:text-primary transition-colors"
              onClick={() => onNavigate(i)}
            >
              {item.name}
            </button>
          ) : (
            <span className="text-primary font-medium">{item.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
