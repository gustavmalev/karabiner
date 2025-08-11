import fs from "fs";
import { KarabinerRules } from "./types";
import { createHyperSubLayers, app, open, window, shell } from "./utils";

const rules: KarabinerRules[] = [
  // Define the Hyper key itself
  {
    description: "Hyper Key (⌃⌥⇧⌘)",
    manipulators: [
      {
        description: "Caps Lock -> Hyper Key",
        from: {
          key_code: "caps_lock",
          modifiers: {
            optional: ["any"],
          },
        },
        to: [
          {
            set_variable: {
              name: "hyper",
              value: 1,
            },
          },
        ],
        to_after_key_up: [
          {
            set_variable: {
              name: "hyper",
              value: 0,
            },
          },
        ],
        to_if_alone: [
          {
            key_code: "escape",
          },
        ],
        type: "basic",
      },
    ],
  },
  ...createHyperSubLayers({
    h: { to: [{ key_code: 'left_arrow', modifiers: [] }] },
    j: { to: [{ key_code: 'down_arrow', modifiers: [] }] },
    k: { to: [{ key_code: 'up_arrow', modifiers: [] }] },
    l: { to: [{ key_code: 'right_arrow', modifiers: [] }] },
    m: { to: [{ key_code: 'left_arrow', modifiers: ['left_command'] }] },
    comma: { to: [{ key_code: 'left_arrow', modifiers: ['left_alt'] }] },
    period: { to: [{ key_code: 'right_arrow', modifiers: ['left_alt'] }] },
    slash: { to: [{ key_code: 'right_arrow', modifiers: ['left_command'] }] },
    semicolon: { to: [{ key_code: 'delete_or_backspace', modifiers: ['left_alt'] }] },
    quote: { to: [{ key_code: 'delete_forward', modifiers: [] }] },
    c: open('-g raycast://extensions/raycast/clipboard-history/clipboard-history'),
    w: {
      1: window('previous-display'),
      r: { to: [{ key_code: 'escape', modifiers: [] }], description: 'Window: restor' },
      k: window('maximize'),
      c: window('center'),
      f: window('center-half'),
      e: window('top-half'),
      d: window('bottom-half'),
      j: window('left-half'),
      semicolon: window('right-half'),
      i: window('top-left'),
      o: window('top-right'),
      u: window('bottom-left'),
      p: window('bottom-right'),
      comma: window('smaller'),
      period: window('larger'),
      g: window('top-center-two-thirds'),
      n: window('top-center-sixth'),
      m: window('bottom-center-sixth'),
      t: window('move-up')
    },
    o: {
      c: app('Comet'),
      t: app('Trae'),
      g: app('Ghostty'),
      m: app('Messages'),
      s: app('Spotify'),
      e: app('Mail'),
      p: app('Passwords'),
      grave_accent_and_tilde: app('Books')
    },
    r: {
      e: open('raycast://extensions/raycast/emoji-symbols/search-emoji-symbols'),
      a: open('-g raycast://extensions/raycast/raycast-ai/ai-chat'),
      s: open('-g raycast://extensions/raycast/file-search/search-files'),
      k: open('raycast://extensions/raycast/calendar/my-schedule'),
      n: open('-g raycast://extensions/raycast/raycast-notes/raycast-notes'),
      o: open('-g raycast://extensions/huzef44/screenocr/recognize-text'),
      grave_accent_and_tilde: app('Dia')
    },
    y: {
    },
    t: {
    },
    q: {
    },
    p: {
      j: { to: [{ key_code: 'delete_or_backspace', modifiers: ['left_control'] }], description: 'Keypress' }
    }
  }),
];

fs.writeFileSync(
  "karabiner.json",
  JSON.stringify(
    {
      global: {
        show_in_menu_bar: false,
      },
      profiles: [
        {
          name: "Default",
          complex_modifications: {
            rules,
          },
        },
      ],
    },
    null,
    2
  )
);
