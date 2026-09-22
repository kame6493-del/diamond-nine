interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  tone?: "blue" | "green" | "yellow" | "red";
}

const toneClass = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

export function ProgressBar({ value, max = 100, label, tone = "blue" }: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-sm font-bold text-slate-700">
          <span>{label}</span>
          <span>{Math.round(value)}/{max}</span>
        </div>
      )}
      <div className="h-4 overflow-hidden rounded-full border-2 border-slate-800 bg-slate-100">
        <div className={`h-full ${toneClass[tone]}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
