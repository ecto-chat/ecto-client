import { Spinner } from '@/ui';

export function SplashScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-primary">
      <h1 className="text-3xl text-primary">Ecto</h1>
      <Spinner size="lg" />
    </div>
  );
}
