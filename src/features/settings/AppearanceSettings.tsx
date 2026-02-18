import { useState } from 'react';

import { Button, TextArea } from '@/ui';

import { useUiStore } from '@/stores/ui';

export function AppearanceSettings() {
  const customCSS = useUiStore((s) => s.customCSS);
  const setCustomCSS = useUiStore((s) => s.setCustomCSS);

  const [cssInput, setCssInput] = useState(customCSS);
  const [applied, setApplied] = useState(false);

  const handleApplyCSS = () => {
    setCustomCSS(cssInput);

    if (window.electronAPI?.theme?.injectCSS) {
      window.electronAPI.theme.injectCSS(cssInput);
    }

    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const handleResetCSS = () => {
    setCssInput('');
    setCustomCSS('');

    if (window.electronAPI?.theme?.injectCSS) {
      window.electronAPI.theme.injectCSS('');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-primary">Appearance</h2>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-secondary">Custom CSS</h3>
        <p className="text-xs text-muted">
          Add custom CSS to personalize your client. Changes apply immediately when you click Apply.
        </p>
        <TextArea
          value={cssInput}
          onChange={(e) => setCssInput(e.target.value)}
          maxRows={14}
          placeholder={`/* Example: change accent color */\n:root {\n  --accent: #e91e63;\n}`}
          spellCheck={false}
          className="font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button onClick={handleApplyCSS}>
            {applied ? 'Applied!' : 'Apply'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleResetCSS}
            disabled={!cssInput && !customCSS}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
