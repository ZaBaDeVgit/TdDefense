// Escenarios del juego. Cada mapa es una rejilla ASCII (24 x 14):
//  '.' terreno   '#' obstaculo/edificio   '~' agua   'P' carretera (ruta)   'S' entrada enemigos   'B' base
// La ruta de los enemigos se calcula automaticamente (BFS) desde S hasta B.

export const SCENARIOS = [
  {
    id: 'base',
    name: 'Base Militar',
    desc: 'Campo verde con la base principal, un rio y el helipuerto.',
    theme: {
      ground: [0x5b7a3a, 0x4f6e33, 0x6a8a44], road: 0x3b3d42,
      skyTop: '#2b3f66', skyBottom: '#f0a35a', fog: 0xc9a27a,
      sun: 0xffd9a0, sunIntensity: 2.2, hemi: 0x9fc4ff, water: 0x1f6fa8,
      deco: ['pine', 'broadleaf', 'rock', 'watch', 'barracks'],
    },
    grid: [
      '........................',
      '.S......~~~.............',
      '.PPPPPPPP~~~......##....',
      '........P.........##....',
      '..##....P..........#....',
      '..##....PPPPPPPP........',
      '.......P.......P...##...',
      '.......P.......P...##...',
      '.......PPPPPPPPP........',
      '.........P..........#...',
      '.........PPPPPPPPPPPPB..',
      '........................',
      '........................',
      '........................',
    ],
  },
  {
    id: 'desierto',
    name: 'Desierto',
    desc: 'Dunas, mesetas y un oasis junto a la ruta del convoy.',
    theme: {
      ground: [0xc9a46a, 0xb8925a, 0xd8b57c], road: 0x6e5a44,
      skyTop: '#6a4a7a', skyBottom: '#ffb469', fog: 0xe0b888,
      sun: 0xffe2b0, sunIntensity: 2.6, hemi: 0xffe6c0, water: 0x3a9ab8,
      deco: ['cactus', 'dune', 'rock', 'palm'],
    },
    grid: [
      '........................',
      '................~~~.###.',
      '.SPPPPPPPP.....~~~~.###.',
      '.........P.....~~~~.....',
      '.........P..###.........',
      '.........P..###.........',
      '.........P..............',
      '.........PPPPPPPPPPP....',
      '...................P....',
      '...................P....',
      '..###......###.....P....',
      '..###......###.....PPPB.',
      '...........###..........',
      '........................',
    ],
  },
  {
    id: 'montana',
    name: 'Montaña',
    desc: 'Bosques, riscos y un paso de montaña en zigzag.',
    theme: {
      ground: [0x3d5a35, 0x32502c, 0x4f6b3e], road: 0x4a4a4e,
      skyTop: '#44608a', skyBottom: '#9fb8d0', fog: 0xb9c7d6,
      sun: 0xfff1d6, sunIntensity: 2.0, hemi: 0xbcd6ff, water: 0x2a6f9a,
      deco: ['pine', 'snowrock', 'rock'],
    },
    grid: [
      '###....#####....########',
      '###....#####....########',
      '###....#####....########',
      '..........~~............',
      '.S........~~...PPPPP....',
      '.P........~~...P...P....',
      '.PPPPPPPP......P...P....',
      '........P......P...P....',
      '........P......P...P....',
      '........PPPPPPPP...P....',
      '...................P....',
      '.###.............##PPPB.',
      '.###........###..#####..',
      '............###..#####..',
    ],
  },
  {
    id: 'ciudad',
    name: 'Ciudad',
    desc: 'Calles urbanas en ruinas bajo un cielo nocturno.',
    theme: {
      ground: [0x50555c, 0x44484f, 0x5c6168], road: 0x2a2c31,
      skyTop: '#0b0f20', skyBottom: '#2a2f55', fog: 0x1e2440,
      sun: 0x9fb4ff, sunIntensity: 1.4, hemi: 0x5068a8, water: 0x1b3d66,
      deco: ['skyscraper', 'lamp', 'car'],
    },
    grid: [
      '........................',
      '.S.......##..##..##.....',
      '.P.##....##..##..##.....',
      '.P.##....##..##..##..##.',
      '.P.##.........###....##.',
      '.P............###..####.',
      '.PPPPPP............##...',
      '......P............##...',
      '......P.................',
      '......PPPPPPPPPPPPPPPPB.',
      '........................',
      '...##....##.##....##....',
      '...##....##.##....##....',
      '........................',
    ],
  },
];

export function parseScenario(sc) {
  const H = sc.grid.length;
  const W = Math.max(...sc.grid.map((r) => r.length));
  const tiles = [];
  let spawn = null, base = null;
  for (let r = 0; r < H; r++) {
    tiles.push([]);
    for (let c = 0; c < W; c++) {
      const ch = (sc.grid[r] || '')[c] || '.';
      tiles[r].push(ch);
      if (ch === 'S') spawn = { c, r };
      if (ch === 'B') base = { c, r };
    }
  }
  if (!spawn || !base) throw new Error('Mapa sin S o B: ' + sc.id);
  // BFS sobre la carretera (P, S, B) desde S hasta B: ruta mas corta
  const passable = (c, r) => r >= 0 && r < H && c >= 0 && c < W && 'PSB'.includes(tiles[r][c]);
  const prev = new Map();
  const key = (c, r) => r * W + c;
  const q = [spawn];
  let qi = 0;
  prev.set(key(spawn.c, spawn.r), null);
  let found = false;
  while (qi < q.length) {
    const cur = q[qi++];
    if (cur.c === base.c && cur.r === base.r) { found = true; break; }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (passable(nc, nr) && !prev.has(key(nc, nr))) {
        prev.set(key(nc, nr), cur);
        q.push({ c: nc, r: nr });
      }
    }
  }
  if (!found) throw new Error('Sin ruta valida en ' + sc.id);
  const path = [];
  let node = base;
  while (node) { path.push({ c: node.c, r: node.r }); node = prev.get(key(node.c, node.r)); }
  path.reverse();
  return { W, H, tiles, spawn, base, path };
}
