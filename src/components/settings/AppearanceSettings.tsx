import { useState } from 'react';
import { useUiStore } from '../../stores/ui.js';

export function AppearanceSettings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const customCSS = useUiStore((s) => s.customCSS);
  const setCustomCSS = useUiStore((s) => s.setCustomCSS);

  const [cssInput, setCssInput] = useState(customCSS);
  const [applied, setApplied] = useState(false);

  const handleThemeToggle = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleApplyCSS = () => {
    setCustomCSS(cssInput);

    // Inject into Electron if available
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
    <div className="settings-section">
      <h2 className="settings-heading">Appearance</h2>

      <div className="settings-group">
        <h3 className="settings-subheading">Theme</h3>
        <div className="theme-toggle-group">
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'dark' ? 'theme-toggle-active' : ''}`}
            onClick={() => handleThemeToggle('dark')}
          >
            <span className="theme-toggle-icon">&#9790;</span>
            Dark
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'light' ? 'theme-toggle-active' : ''}`}
            onClick={() => handleThemeToggle('light')}
          >
            <span className="theme-toggle-icon">&#9788;</span>
            Light
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-subheading">Custom CSS</h3>
        <p className="settings-hint">
          Add custom CSS to personalize your client. Changes apply immediately when you click Apply.
        </p>
        <textarea
          value={cssInput}
          onChange={(e) => setCssInput(e.target.value)}
          rows={10}
          placeholder={`/* Example: change accent color */\n:root {\n  --accent: #e91e63;\n}`}
          className="settings-input settings-textarea settings-css-editor"
          spellCheck={false}
        />
        <div className="settings-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleApplyCSS}
          >
            {applied ? 'Applied!' : 'Apply'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetCSS}
            disabled={!cssInput && !customCSS}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
