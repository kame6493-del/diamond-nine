import { Image, Sparkles } from "lucide-react";
import { CUT_ASSET_LIST } from "../../constants/assets";
import { GamePanel } from "../common/GamePanel";
import { AssetImage } from "./AssetImage";

export function AssetPreviewScreen() {
  return (
    <div className="grid gap-4">
      <GamePanel title="アセット確認" icon={<Image size={22} />}>
        <div className="grid gap-3 md:grid-cols-[1fr_1.1fr] md:items-center">
          <AssetImage asset="previewContactSheet" alt="切り出し済みPNG一覧" imgClassName="w-full" />
          <div className="grid gap-3">
            <p className="rounded-xl border-2 border-blue-950 bg-yellow-100 p-4 text-lg font-black text-slate-900">
              制作用PNGを `public/assets/production/` から読み込んでいます。通常画面では、透過マスコットや
              カード、スコアボード、パネル画像を装飾として使い、配色と枠線はCSSで統一しています。
            </p>
            <div className="grid grid-cols-3 gap-2">
              <AssetImage asset="mascotStanding" alt="立ちマスコット" noFrame imgClassName="mx-auto h-28 object-contain" />
              <AssetImage asset="mascotPointing" alt="案内マスコット" noFrame imgClassName="mx-auto h-28 object-contain" />
              <AssetImage asset="mascotCheering" alt="応援マスコット" noFrame imgClassName="mx-auto h-28 object-contain" />
            </div>
          </div>
        </div>
      </GamePanel>

      <GamePanel title="切り出し済みPNG一覧" icon={<Sparkles size={22} />}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CUT_ASSET_LIST.map((asset) => (
            <article
              key={asset.key}
              className="asset-preview-card rounded-xl border-4 border-blue-950 bg-white p-3 shadow-[0_5px_0_rgba(8,47,73,0.22)]"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-blue-950">{asset.title}</h3>
                  <p className="text-xs font-bold text-slate-500">{asset.fileName}</p>
                </div>
              </div>
              <div className="flex min-h-40 items-center justify-center rounded-lg border-2 border-blue-950 bg-[linear-gradient(45deg,#f8fafc_25%,#eef6ff_25%,#eef6ff_50%,#f8fafc_50%,#f8fafc_75%,#eef6ff_75%)] bg-[length:18px_18px] p-2">
                <AssetImage asset={asset.key} alt={asset.title} noFrame imgClassName="max-h-40 max-w-full object-contain" />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-700">{asset.description}</p>
            </article>
          ))}
        </div>
      </GamePanel>
    </div>
  );
}
