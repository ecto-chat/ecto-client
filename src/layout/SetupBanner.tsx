interface SetupBannerProps {
  onClick: () => void;
}

export function SetupBanner({ onClick }: SetupBannerProps) {
  return (
    <div
      className="bg-accent text-inverse px-4 py-2.5 text-sm font-semibold cursor-pointer text-center hover:bg-accent-hover transition-colors duration-150"
      onClick={onClick}
    >
      Complete Server Setup
    </div>
  );
}
