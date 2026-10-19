// Theme colours that change between light and dark mode, as "R G B" channels so Tailwind can
// add opacity (bg-sky/60). Shared by tailwind.config.js (defaults) and src/theme/theme.tsx.
module.exports = {
  light: {
    '--surface': '255 255 255',
    '--sky': '227 240 253',
    '--ink': '29 27 32',
    '--ink-muted': '90 90 90',
    '--ink-subtle': '102 102 102',
    '--line': '217 217 217',
    '--line-strong': '179 179 179',
    '--emphasis': '1 29 57',
  },
  dark: {
    '--surface': '17 20 24',
    '--sky': '27 38 52',
    '--ink': '236 238 241',
    '--ink-muted': '168 174 184',
    '--ink-subtle': '138 145 156',
    '--line': '44 50 58',
    '--line-strong': '73 81 92',
    '--emphasis': '156 194 255',
  },
};
