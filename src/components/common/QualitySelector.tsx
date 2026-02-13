import {
  QUALITY_OPTIONS,
  SCREEN_QUALITY_OPTIONS,
  getVideoQuality,
  getScreenQuality,
  setVideoQuality,
  setScreenQuality,
  type VideoQuality,
  type ScreenQuality,
} from '../../lib/media-presets.js';

export function QualitySelector({
  kind,
  onClose,
}: {
  kind: 'video' | 'screen';
  onClose: () => void;
}) {
  const options = kind === 'video' ? QUALITY_OPTIONS : SCREEN_QUALITY_OPTIONS;
  const selectedValue = kind === 'video' ? getVideoQuality() : getScreenQuality();

  const handleSelect = (value: string) => {
    if (kind === 'video') setVideoQuality(value as VideoQuality);
    else setScreenQuality(value as ScreenQuality);
    onClose();
  };

  return (
    <div className="device-selector">
      <div className="device-selector-header">
        {kind === 'video' ? 'Camera Quality' : 'Screen Share Quality'}
      </div>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`device-selector-item ${selectedValue === opt.value ? 'selected' : ''}`}
          onClick={() => handleSelect(opt.value)}
        >
          {selectedValue === opt.value && <span className="device-check">&#10003;</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
