export interface OsWindow {
  id:          string;
  title:       string;
  icon:        string;
  filename:    string;
  isOpen:      boolean;
  isMinimized: boolean;
  x:           number;
  y:           number;
  zIndex:      number;
  width:       number;
  height:      number;
  onDesktop:   boolean;
  desktopX:    number;
  desktopY:    number;
}