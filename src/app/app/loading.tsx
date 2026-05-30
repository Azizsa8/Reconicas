// App-level loading fallback. Shown during /app route transitions while the
// server component fetches data. Keeps the chrome (sidebar/topbar) visible
// via the layout and animates a thin progress bar across the main area.

export default function AppLoading() {
  return (
    <div className="px-6 py-5 max-w-[1400px]">
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-48 bg-[var(--bg-elevated)] rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="h-3 w-12 bg-[var(--bg-elevated)] rounded" />
              <div className="h-6 w-16 bg-[var(--bg-elevated)] rounded" />
              <div className="h-3 w-20 bg-[var(--bg-elevated)] rounded" />
            </div>
          ))}
        </div>
        <div className="card p-4 space-y-2">
          <div className="h-4 w-32 bg-[var(--bg-elevated)] rounded" />
          <div className="h-3 w-full bg-[var(--bg-elevated)] rounded" />
          <div className="h-3 w-3/4 bg-[var(--bg-elevated)] rounded" />
          <div className="h-3 w-1/2 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
    </div>
  );
}
