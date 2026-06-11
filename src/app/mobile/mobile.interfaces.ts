export interface MobileApp {
  id:    string;
  title: string;
  icon:  string;
}

export type MobileView = 'home' | 'app' | 'notifications' | 'recents';