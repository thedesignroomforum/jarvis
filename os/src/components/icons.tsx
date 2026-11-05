/* Minimal stroke icons (24px grid, 1.6 stroke) so the UI has no icon dependency. */
type P = { className?: string };
const base = (d: React.ReactNode, className = "h-[18px] w-[18px]") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {d}
  </svg>
);
export const IconHome = ({ className }: P) => base(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />, className);
export const IconChat = ({ className }: P) => base(<path d="M4 5h16v11H8l-4 4z" />, className);
export const IconMic = ({ className }: P) => base(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, className);
export const IconFolder = ({ className }: P) => base(<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />, className);
export const IconBook = ({ className }: P) => base(<><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z" /><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" /></>, className);
export const IconSpark = ({ className }: P) => base(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />, className);
export const IconEye = ({ className }: P) => base(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>, className);
export const IconSearch = ({ className }: P) => base(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>, className);
export const IconTarget = ({ className }: P) => base(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>, className);
export const IconSun = ({ className }: P) => base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>, className);
export const IconMoon = ({ className }: P) => base(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />, className);
export const IconBrain = ({ className }: P) => base(<path d="M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10v1a3 3 0 0 0 1 2.2V15a3 3 0 0 0 3 3h1V4zM15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 2.5v1a3 3 0 0 1-1 2.2V15a3 3 0 0 1-3 3h-1V4z" />, className);
export const IconGear = ({ className }: P) => base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, className);
export const IconImage = ({ className }: P) => base(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>, className);
export const IconPaperclip = ({ className }: P) => base(<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" />, className);
export const IconScreen = ({ className }: P) => base(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>, className);
export const IconSend = ({ className }: P) => base(<path d="M5 12h14M13 6l6 6-6 6" />, className);
export const IconStop = ({ className }: P) => base(<rect x="7" y="7" width="10" height="10" rx="1.5" />, className);
export const IconX = ({ className }: P) => base(<path d="M6 6l12 12M18 6L6 18" />, className);
export const IconPlus = ({ className }: P) => base(<path d="M12 5v14M5 12h14" />, className);
export const IconTrash = ({ className }: P) => base(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />, className);
export const IconPin = ({ className }: P) => base(<path d="M9 4h6l-1 5 3 3H7l3-3zM12 12v8" />, className);
export const IconSpeaker = ({ className }: P) => base(<><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9a4 4 0 0 1 0 6" /></>, className);
export const IconMenu = ({ className }: P) => base(<path d="M4 7h16M4 12h16M4 17h16" />, className);
export const IconBookmark = ({ className }: P) => base(<path d="M6 4h12v17l-6-4-6 4z" />, className);
