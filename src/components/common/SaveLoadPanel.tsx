import { RefreshCw, Save, Upload } from "lucide-react";
import { AssetImage } from "../assets/AssetImage";
import { GameButton } from "./GameButton";
import { GamePanel } from "./GamePanel";

interface SaveLoadPanelProps {
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
}

export function SaveLoadPanel({ onSave, onLoad, onReset }: SaveLoadPanelProps) {
  return (
    <GamePanel title="セーブ / ロード" icon={<Save size={22} />}>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-center">
        <div className="grid gap-3 sm:grid-cols-3">
          <GameButton icon={<Save size={20} />} variant="success" onClick={onSave}>
            保存
          </GameButton>
          <GameButton icon={<Upload size={20} />} onClick={onLoad}>
            ロード
          </GameButton>
          <GameButton icon={<RefreshCw size={20} />} variant="danger" onClick={onReset}>
            最初から
          </GameButton>
        </div>
        <AssetImage
          asset="saveSlots"
          alt="セーブスロット参考"
          noFrame
          imgClassName="h-28 w-full rounded-lg border-2 border-blue-950 object-cover object-left"
        />
      </div>
    </GamePanel>
  );
}
