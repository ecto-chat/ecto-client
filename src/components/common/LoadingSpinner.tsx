export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="loading-spinner"
      style={{
        width: size,
        height: size,
        border: `3px solid var(--bg-tertiary, #2f3136)`,
        borderTopColor: `var(--accent, #5865f2)`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}
