export const labelMap: Record<string, string> = {
  hyphen: '-',
  equal_sign: '=',
  open_bracket: '[',
  close_bracket: ']',
  backslash: '\\',
  non_us_pound: '§',
  semicolon: ';',
  quote: "'",
  grave_accent_and_tilde: '`',
  comma: ',',
  period: '.',
  slash: '/',
  escape: 'esc',
  left_shift: 'shift',
  right_shift: 'shift',
  left_option: 'opt',
  right_option: 'opt',
  left_command: 'cmd',
  right_command: 'cmd',
  return_or_enter: 'enter',
  delete_or_backspace: 'delete',
};

export const keyboardLayout = {
  numberRow: ['grave_accent_and_tilde','1','2','3','4','5','6','7','8','9','0','hyphen','equal_sign'],
  topRow: ['q','w','e','r','t','y','u','i','o','p','open_bracket','close_bracket','backslash'],
  homeRow: ['a','s','d','f','g','h','j','k','l','semicolon','quote'],
  bottomRow: ['z','x','c','v','b','n','m','comma','period','slash'],
};

export const { numberRow, topRow, homeRow, bottomRow } = keyboardLayout;

export function labelForKey(code: string): string {
  const label = labelMap[code] || code.toUpperCase();
  return label.length > 2 ? code : label;
}
