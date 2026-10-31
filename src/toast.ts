import { create } from 'zustand';

interface Toast {
  text: string;
  warn: boolean;
  /** A new toast with the same text still shows again */
  id: number;
}

export const useToast = create<{ toast: Toast | null }>(() => ({ toast: null }));

let hideTimer: ReturnType<typeof setTimeout> | undefined;
let lastId = 0;

export function showToast(text: string, { warn = false } = {}) {
  clearTimeout(hideTimer);
  useToast.setState({ toast: { text, warn, id: ++lastId } });
  hideTimer = setTimeout(() => useToast.setState({ toast: null }), warn ? 8000 : 4000);
}
