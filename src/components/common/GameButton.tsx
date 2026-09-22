import type { ButtonHTMLAttributes, ReactNode } from "react";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
}

const variantClass = {
  primary:
    "border-blue-950 bg-gradient-to-b from-blue-400 via-blue-600 to-blue-800 text-white hover:-translate-y-0.5 disabled:from-slate-200 disabled:via-slate-300 disabled:to-slate-400",
  secondary:
    "border-amber-900 bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 text-slate-950 hover:-translate-y-0.5 disabled:from-slate-100 disabled:via-slate-200 disabled:to-slate-300",
  success:
    "border-green-950 bg-gradient-to-b from-lime-300 via-green-500 to-green-700 text-white hover:-translate-y-0.5 disabled:from-slate-100 disabled:via-slate-200 disabled:to-slate-300",
  danger:
    "border-red-950 bg-gradient-to-b from-red-300 via-red-500 to-red-700 text-white hover:-translate-y-0.5 disabled:from-slate-100 disabled:via-slate-200 disabled:to-slate-300",
  ghost:
    "border-slate-800 bg-gradient-to-b from-white via-blue-50 to-slate-100 text-slate-800 hover:-translate-y-0.5 disabled:from-slate-100 disabled:to-slate-200",
};

export function GameButton({
  children,
  className = "",
  icon,
  variant = "primary",
  ...props
}: GameButtonProps) {
  return (
    <button
      className={`asset-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2 text-base font-black shadow-[0_5px_0_rgba(8,47,73,0.45)] transition active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500 ${variantClass[variant]} ${className}`}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
