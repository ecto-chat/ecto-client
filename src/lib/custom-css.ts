const STYLE_ID = 'ecto-custom-css';

export function applyCustomCSS(css: string) {
  // Prefer Electron's native insertCSS if available
  if (window.electronAPI?.theme?.injectCSS) {
    window.electronAPI.theme.injectCSS(css);
    return;
  }

  // Web fallback: inject via <style> tag
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

  if (!css) {
    el?.remove();
    return;
  }

  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }

  el.textContent = css;
}
