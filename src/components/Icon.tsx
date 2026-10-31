// Line icons in the style of Expense Tracker's.
const PATHS = {
  bank: <path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pen: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  bin: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 00-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0014.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  login: (
    <>
      <path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
      <path d="M10 16l4-4-4-4M14 12H4" />
    </>
  ),
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
};

export type IconName = keyof typeof PATHS;

/** Decorative: always next to text or inside a labelled button */
export function Icon({ name, size = 14, weight = 2 }: { name: IconName; size?: number; weight?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
