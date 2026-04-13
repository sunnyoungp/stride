// Custom confirm dialog bridge — replaces window.confirm() which doesn't work in Tauri v2 (WKWebView).
// Components register a handler; callers await appConfirm(message).

type ConfirmHandler = (message: string, resolve: (value: boolean) => void) => void;

const handlers: ConfirmHandler[] = [];

export function registerConfirmHandler(handler: ConfirmHandler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  };
}

export function appConfirm(message: string): Promise<boolean> {
  if (handlers.length === 0) {
    // Fallback: browser native confirm (works outside Tauri)
    if (typeof window !== "undefined") {
      return Promise.resolve(window.confirm(message));
    }
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    handlers[0](message, resolve);
  });
}
