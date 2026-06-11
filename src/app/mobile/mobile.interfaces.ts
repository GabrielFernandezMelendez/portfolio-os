export interface MobileApp {
  id:       string;
  title:    string;
  icon:     string;  // ← emoji (fallback)
  iconSvg?: string;  // ← ruta SVG (opcional, para cuando exista)
}

export type MobileView = 'home' | 'app' | 'notifications' | 'recents';