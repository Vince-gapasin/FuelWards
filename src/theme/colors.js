// Brand palette pulled from the FUELWARDS Figma file (mODm20NVwxDhimytGSUtUR).
// Shared by tailwind.config.js (class names) and TypeScript code (map layers, status bar).
// Neutral colours read CSS variables (src/theme/palette.js) so they switch in dark mode.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  navy: { DEFAULT: '#011D39', 600: '#034B93' },
  brand: { DEFAULT: '#00BF63', light: '#46D755' },
  fuel: '#FCCD0D',
  star: '#FFDF00',
  // Darker than the Figma #007BFF so white text on it meets WCAG AA (5.4:1).
  action: '#0066D6',
  points: '#FF8800',
  danger: { DEFAULT: '#BB0000', bright: '#FF0000' },
  surface: v('surface'),
  sky: v('sky'),
  emphasis: v('emphasis'),
  // Text colours that need AA contrast on both light and dark surfaces.
  link: v('link'),
  positive: v('positive'),
  critical: v('critical'),
  ink: { DEFAULT: v('ink'), muted: v('ink-muted'), subtle: v('ink-subtle') },
  line: { DEFAULT: v('line'), strong: v('line-strong') },
};
