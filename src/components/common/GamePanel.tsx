import type { ReactNode } from "react";

interface GamePanelProps {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function GamePanel({ children, title, icon, className = "", actions }: GamePanelProps) {
  return (
    <section className={`asset-panel rounded-xl border-4 border-blue-950 bg-white p-4 shadow-game ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="asset-panel-title flex items-center gap-2 rounded-br-xl border-2 border-blue-950 bg-gradient-to-b from-blue-500 to-blue-800 px-4 py-2 text-xl font-black text-white shadow-[0_3px_0_rgba(8,47,73,0.28)]">
              {icon}
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
