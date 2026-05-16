"use client";

interface AvatarProps {
  image?: string | null;
  title?: string;
  size?: number;
  className?: string;
  rounded?: string;
}

export default function Avatar({ image, title, size = 48, className = "", rounded = "rounded-full" }: AvatarProps) {
  const letter = title?.[0]?.toUpperCase() ?? "?";
  const isColor = image?.startsWith("#");

  if (isColor) {
    return (
      <div
        className={`flex items-center justify-center shrink-0 font-bold select-none ${rounded} ${className}`}
        style={{ width: size, height: size, backgroundColor: image!, fontSize: size * 0.38, color: getContrastColor(image!) }}
      >
        {letter}
      </div>
    );
  }

  if (image) {
    return (
      <img
        src={image}
        alt={title}
        className={`object-cover shrink-0 ${rounded} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // fallback — violet gradient
  return (
    <div
      className={`flex items-center justify-center shrink-0 font-bold select-none bg-gradient-to-br from-violet-500/20 to-purple-500/20 ${rounded} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38, color: "#a78bfa" }}
    >
      {letter}
    </div>
  );
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000cc" : "#ffffffee";
}

export { generateAvatarColor } from "@/lib/avatar";
