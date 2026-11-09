import type { CSSProperties } from "react";
export function SupportIcon({
  name,
  className = "h-4 w-4",
  style,
}: {
  name:
    | "arrow"
    | "person"
    | "ticket"
    | "copy"
    | "link"
    | "check"
    | "history"
    | "close"
    | "message"
    | "bell"
    | "mute"
    | "more"
    | "reply";
  className?: string;
  style?: CSSProperties;
}) {
  const paths = {
    arrow: <path d="m6 12 6-6 6 6M12 6v13" />,
    person: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),
    ticket: (
      <>
        <path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z" />
        <path d="M15 5v3m0 3v2m0 3v3" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    link: (
      <>
        <path d="M14 4h6v6M20 4 10 14" />
        <path d="M10 4H4v16h16v-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    history: (
      <>
        <path d="M3 4v5h5M3.8 9a9 9 0 1 1 .7 8" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    bell: (
      <>
        <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2Z" />
        <path d="M10 21h4" />
      </>
    ),
    mute: (
      <>
        <path d="M6 16v-5a6 6 0 0 1 9.5-4.8M18 11v5l2 2H4l2-2M10 21h4" />
        <path d="m4 4 16 16" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    reply: (
      <>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 6 6v3" />
      </>
    ),
    message: (
      <>
        <path d="M20 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v9Z" />
        <path d="M7 8h9M7 12h6" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
