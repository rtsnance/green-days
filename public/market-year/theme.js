/* Green Days tokens for the walk. Every value traces to the brand sheet or to
   card XIV; nothing here is invented. Keep this file as the only place colour
   lives — walk.js reads it and holds none of its own. */

export const SEASON_HUE = { Winter: 208, Spring: 152, Summer: 44, Autumn: 26 };

export const THEMES = {
  daylight: {
    skyTop: '#e6ecf6', skyBottom: '#f6f2e6', edge: 'rgba(31,54,97,0.16)',
    fogEnd: 340, fogFloor: .07,
    tread:     { sat: 6, lightA: 91, lightB: 88 },
    treadPast: { sat: 4, lightA: 80, lightB: 77 },
    treadNow:  'hsl(157 30% 82%)',
    riser:     { sat: 30, light: 58, pastSat: 5, pastLight: 66 },
    axis: {
      thread: 'rgba(82,157,127,0.40)', behind: 'rgba(141,157,166,0.55)',
      ahead:  'rgba(82,157,127,0.75)', face: "600 11px 'JetBrains Mono',monospace"
    },
    plate: {
      bg: '#fcf8ee', frame: '#1f3661', inner: '#1f3661', name: '#1f3661',
      here: '#35735b', meta: '#4d606b', epi: '#c9410f', rule: '#cdd6dd',
      post: '#8d9da6', spentBg: '#eef1f0', spentFrame: '#8d9da6',
      spentInk: '#7e8e97', spentEpi: '#b9a49b', strike: '#c0392b', gold: '#a88024'
    },
    hud: {
      '--gg-ink': '#1f3661', '--gg-muted': '#4d606b', '--gg-accent': '#35735b',
      '--gg-paprika': '#c9410f', '--gg-gold': '#a88024', '--gg-line': '#d5ece6',
      '--gg-plate': '#fcf8eeee'
    }
  },
  dusk: {
    skyTop: '#0f1b1e', skyBottom: '#131f1c', edge: 'rgba(213,236,230,0.10)',
    fogEnd: 340, fogFloor: .22,
    tread:     { sat: 5, lightA: 15, lightB: 12 },
    treadPast: { sat: 3, lightA: 9,  lightB: 7 },
    treadNow:  'hsl(157 26% 26%)',
    riser:     { sat: 22, light: 20, pastSat: 4, pastLight: 11 },
    axis: {
      thread: 'rgba(82,157,127,0.32)', behind: 'rgba(77,96,107,0.6)',
      ahead:  'rgba(82,157,127,0.7)', face: "600 11px 'JetBrains Mono',monospace"
    },
    plate: {
      bg: '#16241f', frame: '#7ec2a3', inner: '#2c463c', name: '#f2f8f5',
      here: '#ddb140', meta: '#8fa39c', epi: '#ea8a63', rule: '#2c463c',
      post: '#4d606b', spentBg: '#141c1e', spentFrame: '#3a4a4e',
      spentInk: '#5d6f76', spentEpi: '#6b6058', strike: '#c0392b', gold: '#ddb140'
    },
    hud: {
      '--gg-ink': '#f2f8f5', '--gg-muted': '#8fa39c', '--gg-accent': '#7ec2a3',
      '--gg-paprika': '#ea8a63', '--gg-gold': '#ddb140', '--gg-line': '#26363a',
      '--gg-plate': '#0f1b1eee'
    }
  }
};

/* The shape of the world. PITCH / TAPER / WIDTH are tunable by eye;
   the rest is structural. */
export const GEOM = {
  R: 100, WIDTH: 11, PITCH: 40, TAPER: 15,
  EYE: 2.7, F: 470, NEAR: .5, HORIZON_DAYS: 300
};

export const MOTION = {
  walkSpeed: .08, wheelGain: .12, lookGain: .005, tiltGain: .003, restTilt: -.30
};
