export type KeyCode = string;

export type Command = {
  to?: Array<{ key_code?: string | undefined; modifiers?: string[] | undefined; shell_command?: string | undefined }> | undefined;
  description?: string | undefined;
};

export type Layer =
  | { type: 'sublayer'; commands: Record<KeyCode, Command> }
  | { type: 'command'; command: Command };

export type Config = { layers: Record<KeyCode, Layer> };

export type Data = {
  base: {
    sublayerKeys: KeyCode[];
    customKeys: Array<{ key: KeyCode }>;
    fallbackKeys: KeyCode[];
  };
};

export type AppInfo = {
  name: string;
  bundleId?: string | undefined;
  path?: string | undefined;
  category?: string | undefined; // LSApplicationCategoryType, e.g. "public.app-category.productivity"
  categoryLabel?: string | undefined; // Human label derived from category, e.g. "Productivity"
  iconUrl?: string | undefined; // Server-exposed PNG endpoint for app icon
};
