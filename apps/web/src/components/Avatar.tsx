"use client";

import { useEffect, useRef, useState } from "react";
import { avatarInitials } from "@/lib/avatar";

type Tone = "neutral" | "primary" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-raised text-ink ring-1 ring-line-strong",
  primary: "bg-primary text-primary-fg",
  accent: "bg-clay/10 text-clay",
};

interface Props {
  /** Display name; used for alt text and initials. */
  name: string | null | undefined;
  /** Used for initials when there is no name. */
  email?: string | null | undefined;
  /** Resolved avatar URL, or null for initials. */
  src?: string | null | undefined;
  /** Pixel size of the circle. */
  size?: number;
  tone?: Tone;
  /** Set when the person's name is already shown next to the avatar. */
  decorative?: boolean;
  title?: string;
  className?: string;
}

/** A person's profile picture, falling back to initials when there is none or it fails to load. */
export function Avatar({ name, email, src, size = 28, tone = "neutral", decorative = false, title, className = "" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const label = name?.trim() || email || "Unknown user";
  const showImage = !!src && failedSrc !== src;

  // An image that failed before hydration never fires onError in React.
  useEffect(() => {
    const img = imgRef.current;
    if (src && img?.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  return (
    <span
      title={title}
      role={decorative || showImage ? undefined : "img"}
      aria-label={decorative || showImage ? undefined : label}
      aria-hidden={decorative || undefined}
      className={`relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full font-semibold leading-none ${showImage ? "bg-raised ring-1 ring-line" : tones[tone]} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
    >
      {showImage ? (
        // next/image is not used: provider avatars are already small and sized by the provider.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt={decorative ? "" : label}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{avatarInitials(name, email)}</span>
      )}
    </span>
  );
}
