import { Plus } from 'lucide-react';
import { useUiStore } from '@/stores/ui';
import { IconButton } from '@/ui/IconButton';
import { Tooltip } from '@/ui/Tooltip';

export function AddServerButton() {
  const handleClick = () => {
    useUiStore.getState().openModal('add-server');
  };

  return (
    <Tooltip content="Add a Server" side="right">
      <IconButton
        variant="default"
        size="lg"
        onClick={handleClick}
        className="h-12 w-12 rounded-full bg-tertiary text-success transition-[border-radius,background-color,color] duration-150 hover:rounded-2xl hover:bg-success hover:text-white"
      >
        <Plus size={20} />
      </IconButton>
    </Tooltip>
  );
}
