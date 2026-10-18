export interface MobileApp {
  id:          string;
  title:       string;
  icon:        string;
  iconSvg?:    string;
  isFolder?:   boolean;
  apps?:       MobileApp[];
  folderName?: string;
}

export interface MobilePage {
  id:   string;
  apps: MobileApp[];
}

export type MobileView = 'home' | 'app' | 'notifications' | 'recents';