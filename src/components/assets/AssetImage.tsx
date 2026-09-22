import { ASSET_PATHS, type AssetKey } from "../../constants/assets";

interface AssetImageProps {
  asset: AssetKey;
  alt: string;
  className?: string;
  imgClassName?: string;
  noFrame?: boolean;
}

export function AssetImage({
  asset,
  alt,
  className = "",
  imgClassName = "",
  noFrame = false,
}: AssetImageProps) {
  const frameClass = noFrame ? "" : "rounded-lg border-4 border-blue-950 bg-white shadow-game";

  return (
    <img
      src={ASSET_PATHS[asset]}
      alt={alt}
      className={`block ${frameClass} ${imgClassName || className}`}
      loading="lazy"
    />
  );
}
