export type KeyCode = string;

export type Command = {
  to?: Array<{ key_code?: string; modifiers?: string[]; shell_command?: string }>;
  description?: string;
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

export type AppInfo = { name: string; bundleId?: string; path?: string };
