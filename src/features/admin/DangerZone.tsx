import { useState } from 'react';

import { AlertTriangle } from 'lucide-react';

import { TransferOwnership } from './TransferOwnership';
import { DeleteServer } from './DeleteServer';

type DangerZoneProps = {
  serverId: string;
};

export function DangerZone({ serverId }: DangerZoneProps) {
  const [error, setError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-base font-medium text-danger">
        <AlertTriangle size={18} /> Danger Zone
      </h3>

      {error && <p className="text-sm text-danger">{error}</p>}
      {transferSuccess && <p className="text-sm text-success">{transferSuccess}</p>}

      <TransferOwnership
        serverId={serverId}
        onError={setError}
        onSuccess={(msg) => { setError(''); setTransferSuccess(msg); }}
      />
      <DeleteServer
        serverId={serverId}
        onError={(msg) => { setTransferSuccess(''); setError(msg); }}
      />
    </div>
  );
}
