import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AssetImage } from "../assets/AssetImage";
import { GameButton } from "./GameButton";

interface ResultModalProps {
  open: boolean;
  title: string;
  message: string;
  children?: ReactNode;
  onClose: () => void;
}

export function ResultModal({ open, title, message, children, onClose }: ResultModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/60 p-4">
      <div className="asset-modal max-h-[86vh] w-full max-w-2xl overflow-auto rounded-xl border-4 border-blue-950 bg-white p-5 shadow-[0_16px_0_rgba(8,47,73,0.35)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="inline-block rounded-full border-2 border-blue-950 bg-yellow-300 px-3 py-1 text-sm font-black text-blue-950">
              RESULT
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
          </div>
          <button
            aria-label="閉じる"
            className="rounded-lg border-2 border-blue-950 bg-gradient-to-b from-blue-400 to-blue-700 p-2 text-white shadow-[0_3px_0_rgba(8,47,73,0.3)]"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-[90px_1fr] sm:items-center">
          <AssetImage asset="mascotClipboard" alt="結果案内マスコット" noFrame imgClassName="mx-auto h-28 object-contain" />
          <p className="rounded-xl border-2 border-blue-950 bg-white p-4 text-lg font-bold leading-relaxed text-slate-700">
            {message}
          </p>
        </div>
        {children}
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <AssetImage
            asset="btnConfirmCancelPair"
            alt="決定キャンセルボタン参考"
            noFrame
            imgClassName="hidden h-14 rounded-lg border-2 border-blue-950 object-cover object-left sm:block"
          />
          <GameButton variant="secondary" onClick={onClose}>
            OK
          </GameButton>
        </div>
      </div>
    </div>
  );
}
