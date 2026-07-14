import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

export function SafeImage({ src, alt = "", className, width, height }) {
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    setFailed(!src);
  }, [src]);

  if (failed) {
    return (
      <span
        className={`image-placeholder ${className || ""}`}
        role="img"
        aria-label="Изображение не загружено"
      >
        <ImageOff size={30} aria-hidden="true" />
        <span>Изображение не загружено</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
}
