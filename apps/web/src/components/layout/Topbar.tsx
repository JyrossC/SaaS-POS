interface TopbarProps {
  tenantName?: string;
  userName?: string;
  onLogout: () => void;
}

export function Topbar({ tenantName, userName, onLogout }: TopbarProps) {
  return (
    <header className="topbar bg-surface border-b border-default flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="text-title-md font-bold text-primary">{tenantName}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden sm:block text-body-sm text-secondary">{userName}</span>
        <button
          onClick={onLogout}
          className="text-sm font-medium text-danger hover:bg-danger hover:text-inverse px-3 py-2 rounded-md transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
