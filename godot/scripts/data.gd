# Datos de torres, enemigos, oleadas y escenarios del juego nativo.
class_name TDData
extends RefCounted

const TILE := 2.0
const MAX_WAVE := 15
const START_LIVES := 100
const START_GOLD := 850
const AIR_Y := 3.6
const UPGRADE_COST := [200, 350]
const SKILL_CD := {"misil": 22.0, "radar": 28.0, "nuke": 110.0, "shield": 45.0, "heal": 40.0}

# Torres: dmg, cadencia (s entre disparos), alcance, splash, tierra/aire, cadena
const TOWERS := {
	"mg": {"name": "Flechas", "cost": 100, "color": "#ffb35c", "dmg": 9.0, "rate": 0.13, "range": 6.5, "ground": true, "air": false},
	"missile": {"name": "Cañón de asedio", "cost": 150, "color": "#ff6b4a", "dmg": 70.0, "rate": 1.7, "range": 8.5, "splash": 1.9, "ground": true, "air": false},
	"laser": {"name": "Torre arcana", "cost": 200, "color": "#44c8ff", "dmg": 34.0, "rate": 0.55, "range": 9.5, "ground": true, "air": true},
	"aa": {"name": "Espectral", "cost": 250, "color": "#ffd166", "dmg": 48.0, "rate": 0.9, "range": 10.5, "splash": 1.1, "ground": false, "air": true},
	"tesla": {"name": "Torre de rayos", "cost": 300, "color": "#7fe9ff", "dmg": 26.0, "rate": 1.0, "range": 6.0, "ground": true, "air": true, "chain": 3},
}
const TOWER_ORDER := ["mg", "missile", "laser", "aa", "tesla"]

const ENEMIES := {
	"soldier": {"name": "Soldado", "hp": 40.0, "speed": 3.0, "dmg": 1, "reward": 8, "armor": 0.0, "air": false},
	"shield": {"name": "Soldado Escudo", "hp": 110.0, "speed": 2.3, "dmg": 2, "reward": 15, "armor": 0.35, "air": false},
	"spider": {"name": "Araña Robot", "hp": 70.0, "speed": 4.1, "dmg": 2, "reward": 12, "armor": 0.0, "air": false},
	"jeep": {"name": "Jeep Armado", "hp": 130.0, "speed": 4.8, "dmg": 3, "reward": 18, "armor": 0.05, "air": false},
	"tank": {"name": "Tanque", "hp": 420.0, "speed": 1.9, "dmg": 6, "reward": 40, "armor": 0.25, "air": false},
	"truck": {"name": "Camión Blindado", "hp": 300.0, "speed": 2.8, "dmg": 5, "reward": 30, "armor": 0.15, "air": false},
	"drone": {"name": "Dron", "hp": 90.0, "speed": 4.7, "dmg": 1, "reward": 14, "armor": 0.0, "air": true},
	"heli": {"name": "Helicóptero", "hp": 320.0, "speed": 3.2, "dmg": 6, "reward": 45, "armor": 0.1, "air": true},
}

const SCENARIOS := [
	{
		"id": "base",
		"name": "Base Militar",
		"desc": "Campo verde con la base principal, un rio y el helipuerto.",
		"ground": "#52683c",
		"road": "#414b53",
		"water": "#286f87",
		"sky_top": "#3d7fd6",
		"sky_bottom": "#ffd08a",
		"deco": ["pine","broadleaf","rock","watch","barracks"],
		"grid": [
			"........................",
			".S......~~~.............",
			".PPPPPPPP~~~......##....",
			"........P.........##....",
			"..##....P..........#....",
			"..##....PPPPPPPP........",
			".......P.......P...##...",
			".......P.......P...##...",
			".......PPPPPPPPP........",
			".........P..........#...",
			".........PPPPPPPPPPPPB..",
			"........................",
			"........................",
			"........................",
		]
	},
	{
		"id": "desierto",
		"name": "Desierto",
		"desc": "Dunas, mesetas y un oasis junto a la ruta del convoy.",
		"ground": "#b3905c",
		"road": "#9b7b52",
		"water": "#3ab4d8",
		"sky_top": "#5b8ed8",
		"sky_bottom": "#ffc27a",
		"deco": ["cactus","dune","rock","palm"],
		"grid": [
			"........................",
			"................~~~.###.",
			".SPPPPPPPP.....~~~~.###.",
			".........P.....~~~~.....",
			".........P..###.........",
			".........P..###.........",
			".........P..............",
			".........PPPPPPPPPPP....",
			"...................P....",
			"...................P....",
			"..###......###.....P....",
			"..###......###.....PPPB.",
			"...........###..........",
			"........................",
		]
	},
	{
		"id": "montana",
		"name": "Montaña",
		"desc": "Bosques, riscos y un paso de montaña en zigzag.",
		"ground": "#436743",
		"road": "#6b6f78",
		"water": "#3a8fd0",
		"sky_top": "#2f6fbf",
		"sky_bottom": "#bfe0ff",
		"deco": ["pine","snowrock","rock"],
		"grid": [
			"###....#####....########",
			"###....#####....########",
			"###....#####....########",
			"..........~~............",
			".S........~~...PPPPP....",
			".P........~~...P...P....",
			".PPPPPPPP......P...P....",
			"........P......P...P....",
			"........P......P...P....",
			"........PPPPPPPP...P....",
			"...................P....",
			".###.............##PPPB.",
			".###........###..#####..",
			"............###..#####..",
		]
	},
	{
		"id": "ciudad",
		"name": "Ciudad",
		"desc": "Calles urbanas en ruinas bajo un cielo nocturno.",
		"ground": "#414c58",
		"road": "#2f3440",
		"water": "#2a5fa0",
		"sky_top": "#101a3a",
		"sky_bottom": "#3b4f8f",
		"deco": ["skyscraper","lamp","car"],
		"grid": [
			"........................",
			".S.......##..##..##.....",
			".P.##....##..##..##.....",
			".P.##....##..##..##..##.",
			".P.##.........###....##.",
			".P............###..####.",
			".PPPPPP............##...",
			"......P............##...",
			"......P.................",
			"......PPPPPPPPPPPPPPPPB.",
			"........................",
			"...##....##.##....##....",
			"...##....##.##....##....",
			"........................",
		]
	},
]

# Composición de cada oleada (1..15).
static func build_wave(n: int) -> Array:
	var groups: Array = []
	groups.append({"type": "soldier", "count": 6 + n * 2, "gap": maxf(0.45, 0.9 - n * 0.02), "start": 0.0})
	if n >= 2:
		groups.append({"type": "shield", "count": 1 + floori(n / 2.0), "gap": 1.6, "start": 3.0})
	if n >= 3 and n % 2 == 1:
		groups.append({"type": "jeep", "count": 1 + floori(n / 3.0), "gap": 2.2, "start": 5.0})
	if n >= 4:
		groups.append({"type": "spider", "count": 2 + floori(n / 2.0), "gap": 1.2, "start": 8.0})
	if n >= 5 and n % 3 == 2:
		groups.append({"type": "drone", "count": 2 + floori(n / 4.0), "gap": 2.4, "start": 6.0})
	if n >= 6 and n % 2 == 0:
		groups.append({"type": "tank", "count": 1 + floori((n - 4) / 4.0), "gap": 7.0, "start": 10.0})
	if n >= 7 and n % 2 == 1:
		groups.append({"type": "truck", "count": 1 + floori(n / 6.0), "gap": 4.0, "start": 12.0})
	if n >= 9 and n % 2 == 0:
		groups.append({"type": "heli", "count": 1 + floori(n / 8.0), "gap": 8.0, "start": 9.0})
	if n == 5:
		groups.append({"type": "truck", "boss": true, "count": 1, "gap": 0.0, "start": 16.0})
	if n == 10:
		groups.append({"type": "heli", "boss": true, "count": 1, "gap": 0.0, "start": 14.0})
	if n == 15:
		groups.append({"type": "tank", "boss": true, "count": 1, "gap": 0.0, "start": 18.0})
	var ev: Array = []
	for g in groups:
		for i in range(int(g["count"])):
			ev.append({"t": float(g["start"]) + i * float(g["gap"]), "type": g["type"], "boss": bool(g.get("boss", false))})
	ev.sort_custom(func(a, b): return a["t"] < b["t"])
	return ev
