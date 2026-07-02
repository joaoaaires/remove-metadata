import type { HTMLAttributes, ReactNode } from "react";

type RetroPanelProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  children: ReactNode;
};

export function RetroPanel({ title, children, className = "", ...props }: RetroPanelProps) {
  return (
    <div
      {...props}
      className={`border-2 border-t-retro-highlight border-l-retro-highlight border-b-retro-shadow border-r-retro-shadow bg-retro-panel ${className}`}
    >
      {title && (
        <div className="flex items-center bg-retro-titlebar px-2 py-1">
          <h2 className="truncate font-mono text-sm font-bold text-retro-titlebar-text">{title}</h2>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
