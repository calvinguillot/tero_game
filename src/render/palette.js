// Colours sampled from the reference screenshots.
export const PAL = {
  bg: '#0f2b3b',
  ground: '#2e6d8c',
  puddle: '#29627f',
  shadow: '#245873',
  rippleHi: '#62e2ff',
  rippleMid: '#36bdf0',
  rippleLo: '#2c96c8',
  rain: '#3b9ad0',
  rainFar: '#347fab',
  rainTip: '#c6f1ff',
  splash: '#e4f8ff',
  wallMortar: '#3c4752',
  wallFace: '#8c949c',
  wallHi: '#b8bfc6',
  wallDot: '#a6aeb6',
  wallShadow: '#6b747d',
  wallGroundShadow: '#27607d',
  panel: '#1a4560',
  panelLine: '#245a78',
  panelEdge: '#123649',
  keyFace: '#2f7193',
  keySide: '#1d4d66',
  text: '#f4fbff',
  textDim: '#86bcd6',
  textShadow: '#0f2b3b',
  npcHandle: '#20384a',
  overlay: 'rgba(12, 36, 52, 0.62)',
};

// Player colours from the colour-select screen. Red is reserved for the
// love interest in Story mode, so it is deliberately not selectable.
export const UMBRELLA_COLORS = {
  peach: { light: '#ffeccb', base: '#f6d29a', dark: '#d9a866', outline: '#7a4c22', accent: '#ffffff' },
  mint: { light: '#ecffcc', base: '#c9f09c', dark: '#8fcf63', outline: '#357a24', accent: '#ffffff' },
  teal: { light: '#bdfff8', base: '#5ff0e6', dark: '#2bc4c8', outline: '#14646e', accent: '#ffffff' },
  blue: { light: '#a4dbff', base: '#3fa6ef', dark: '#1f74c4', outline: '#123f7a', accent: '#ffffff' },
  purple: { light: '#bcaaff', base: '#8466ee', dark: '#5a3fc0', outline: '#2c1f6e', accent: '#ffffff' },
  lilac: { light: '#f7caff', base: '#e08cf6', dark: '#b45fd0', outline: '#62267a', accent: '#ffffff' },
  pink: { light: '#ffcad6', base: '#ff8fa8', dark: '#e05f7c', outline: '#7e2438', accent: '#ffffff' },
  // The one you're looking for in Story mode. Nobody else is ever red.
  love: { light: '#ffa0a4', base: '#ec3c48', dark: '#b4202e', outline: '#5c0e18', accent: '#ffffff' },
  // Passers-by stay muted so the player always stands out.
  npc: { light: '#c9dcef', base: '#a9c3df', dark: '#7e9cc0', outline: '#4f6e94', accent: '#e3ecf5' },
  npcSand: { light: '#e2dccf', base: '#c9c1b0', dark: '#a39a88', outline: '#6b6252', accent: '#f2eee6' },
  npcSlate: { light: '#9aa8b8', base: '#7b8a9c', dark: '#5c6a7c', outline: '#36404e', accent: '#c3ccd6' },
  npcYellow: { light: '#eeeacb', base: '#d9d4ac', dark: '#b5ae84', outline: '#6e6844', accent: '#fbf8e8' },
  npcRose: { light: '#e0cdd4', base: '#c6aeb8', dark: '#a08894', outline: '#625060', accent: '#f0e6ea' },
};

export const PLAYER_COLORS = ['peach', 'mint', 'teal', 'blue', 'purple', 'lilac', 'pink'];
export const NPC_COLORS = ['npc', 'npc', 'npcSand', 'npcSlate', 'npcRose'];

export const HANDLE = { base: '#ee9a3a', dark: '#a85a1c' };
