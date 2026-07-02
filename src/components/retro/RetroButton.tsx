import type { ButtonHTMLAttributes } from "react";

type RetroButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function RetroButton({ className = "", ...props }: RetroButtonProps) {
  return (
    <button
      {...props}
      className={`border-2 border-t-retro-highlight border-l-retro-highlight border-b-retro-shadow border-r-retro-shadow bg-retro-panel px-3 py-1 font-mono text-sm text-retro-text active:border-t-retro-shadow active:border-l-retro-shadow active:border-b-retro-highlight active:border-r-retro-highlight disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}
