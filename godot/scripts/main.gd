# Controlador principal de TD Defense (Godot 4.3): menu, mapa 3D, oleadas, torres, habilidades y HUD.
extends Node3D

const AIR_Y := 3.6
const TERRAIN_SHADER := preload("res://shaders/terrain.gdshader")
const WATER_SHADER := preload("res://shaders/water.gdshader")
const GRASS_SHADER := preload("res://shaders/wind_grass.gdshader")
const COL_TEXT := Color("#e8f6ff")
const COL_ACCENT := Color("#3ad0ff")
const COL_WARN := Color("#ff6b5a")
const COL_GOLD := Color("#ffd166")

var cam: Camera3D
var sun: DirectionalLight3D
var env_node: WorldEnvironment
var world: Node3D
var ui: CanvasLayer
var rng := RandomNumberGenerator.new()

var in_game := false
var scen_index := 0
var paused := false
var over := false
var speed := 1.0

# Mapa
var W := 0
var H := 0
var grid: Array = []
var spawn_cell := Vector2i.ZERO
var base_cell := Vector2i.ZERO
var base_pos := Vector3.ZERO
var spawn_pos := Vector3.ZERO
var path_pts: Array = []
var path_len: Array = []
var path_total := 0.0
var air_total := 0.0
var cam_target := Vector3.ZERO
var cam_dist := 46.0
var cam_orbit := 0.0
var wind_time := 0.0
var wind_props: Array = []
var cell_props: Dictionary = {}

# Estado de partida
var gold := 0
var lives := 0
var wave := 0
var kills := 0
var wave_active := false
var wave_time := 0.0
var wave_events: Array = []
var towers: Array = []
var tower_at: Dictionary = {}
var enemies: Array = []
var dying: Array = []
var projectiles: Array = []
var strikes: Array = []
var skill_cd: Dictionary = {}
var base_shield := 0.0
var shield_node: Node3D = null
var build_type := ""
var skill_mode := ""
var selected: Variant = null
var ghost_ring: MeshInstance3D
var ghost_mat: StandardMaterial3D
var sel_ring: MeshInstance3D
var bar_mats: Dictionary = {}

# UI
var menu_root: Control
var hud_root: Control
var pause_root: Control
var end_root: Control
var lbl_gold: Label
var lbl_lives: Label
var lbl_wave: Label
var lbl_kills: Label
var lbl_msg: Label
var btn_speed: Button
var btn_wave: Button
var btn_pause: Button
var tower_btns: Dictionary = {}
var skill_btns: Dictionary = {}
var info_box: PanelContainer
var info_title: Label
var info_stats: Label
var btn_up: Button
var btn_sell: Button
var lbl_end_title: Label
var lbl_end_text: Label
var flash_rect: ColorRect
var msg_t := 0.0
var btn_quality: Button
var btn_menu: Button
var lbl_fps: Label
var top_panel: PanelContainer
var bottom_panel: PanelContainer
var quality := 2
var fps_t := 0.0
var drag_key := ""
var drag_active := false
var drag_start := Vector2.ZERO
var drag_preview: Control = null
var drag_release_frame := -10
var screens: Dictionary = {}

func _ready() -> void:
	rng.randomize()
	cam = Camera3D.new()
	cam.fov = 46.0
	cam.near = 0.5
	cam.far = 400.0
	add_child(cam)
	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 100.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_blend_splits = true
	sun.shadow_bias = 0.045
	sun.shadow_normal_bias = 1.0
	sun.shadow_blur = 1.3
	sun.rotation_degrees = Vector3(-55, 35, 0)
	add_child(sun)
	env_node = WorldEnvironment.new()
	env_node.environment = Environment.new()
	add_child(env_node)
	ui = CanvasLayer.new()
	add_child(ui)
	build_hud()
	build_menu()
	build_pause()
	build_end()
	flash_rect = ColorRect.new()
	flash_rect.color = Color(1, 1, 1, 0)
	flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(flash_rect)
	get_viewport().size_changed.connect(layout_ui)
	layout_ui()
	# Fondo del menú: el primer escenario girando lentamente.
	build_world(0)
	show_menu()

# ====================== UI helpers ======================
func sbox(bg: Color, border: Color, radius: int = 8, bw: int = 2) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(bw)
	s.set_corner_radius_all(radius)
	s.set_content_margin_all(8)
	return s

func mk_button(text: String, cb: Callable, min_size: Vector2 = Vector2(150, 42), font: int = 16) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", font)
	b.add_theme_color_override("font_color", COL_TEXT)
	b.add_theme_color_override("font_outline_color", Color(0, 0, 0, 1))
	b.add_theme_constant_override("outline_size", 5)
	b.add_theme_stylebox_override("normal", sbox(Color(0.03, 0.06, 0.12, 0.96), Color(0.2, 0.7, 1.0, 0.85), 10, 3))
	b.add_theme_stylebox_override("hover", sbox(Color(0.08, 0.2, 0.32, 1.0), COL_ACCENT, 10, 3))
	b.add_theme_stylebox_override("pressed", sbox(Color(0.02, 0.16, 0.26, 0.95), COL_ACCENT))
	b.add_theme_stylebox_override("disabled", sbox(Color(0.08, 0.08, 0.1, 0.7), Color(0.3, 0.3, 0.35, 0.5)))
	b.pressed.connect(cb)
	return b

func mk_label(text: String, font: int = 18, color: Color = COL_TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", font)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("outline_size", 6)
	return l

func panel(bg: Color = Color(0.03, 0.06, 0.12, 0.78)) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", sbox(bg, Color(0.2, 0.7, 1.0, 0.35), 10, 2))
	p.mouse_filter = Control.MOUSE_FILTER_PASS
	return p

func build_hud() -> void:
	hud_root = Control.new()
	hud_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(hud_root)

	# Barra superior
	top_panel = panel()
	var top := top_panel
	top.position = Vector2(12, 10)
	hud_root.add_child(top)
	var top_h := HBoxContainer.new()
	top_h.add_theme_constant_override("separation", 18)
	top.add_child(top_h)
	lbl_gold = mk_label("Oro: $0", 20, COL_GOLD)
	lbl_lives = mk_label("Vidas: 100", 20, Color("#7dff7a"))
	lbl_wave = mk_label("Oleada: 0 / 15", 20, COL_ACCENT)
	lbl_kills = mk_label("Bajas: 0", 20)
	top_h.add_child(lbl_gold)
	top_h.add_child(lbl_lives)
	top_h.add_child(lbl_wave)
	top_h.add_child(lbl_kills)
	btn_speed = mk_button("Velocidad x1", toggle_speed, Vector2(130, 34), 14)
	top_h.add_child(btn_speed)
	btn_pause = mk_button("Pausa (Esc)", toggle_pause, Vector2(120, 34), 14)
	top_h.add_child(btn_pause)
	btn_quality = mk_button("Gráficos: Alta", on_quality, Vector2(170, 34), 14)
	top_h.add_child(btn_quality)
	btn_menu = mk_button("Menú", on_menu, Vector2(90, 34), 14)
	top_h.add_child(btn_menu)
	lbl_fps = mk_label("60 FPS", 14, Color("#7dff7a"))
	top_h.add_child(lbl_fps)

	# Mensajes
	lbl_msg = mk_label("", 22, COL_TEXT)
	lbl_msg.custom_minimum_size = Vector2(600, 0)
	lbl_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_root.add_child(lbl_msg)

	# Panel de torre seleccionada
	info_box = panel()
	info_box.custom_minimum_size = Vector2(280, 0)
	info_box.visible = false
	hud_root.add_child(info_box)
	var iv := VBoxContainer.new()
	iv.add_theme_constant_override("separation", 6)
	info_box.add_child(iv)
	info_title = mk_label("Torre", 22, COL_ACCENT)
	info_stats = mk_label("", 15)
	iv.add_child(info_title)
	iv.add_child(info_stats)
	var ih := HBoxContainer.new()
	iv.add_child(ih)
	btn_up = mk_button("Mejorar", on_upgrade, Vector2(120, 36), 14)
	btn_sell = mk_button("Vender", on_sell, Vector2(120, 36), 14)
	ih.add_child(btn_up)
	ih.add_child(btn_sell)

	# Barra inferior: torres, habilidades y oleadas
	bottom_panel = panel()
	var bottom := bottom_panel
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_top = -118
	bottom.offset_bottom = -12
	bottom.offset_left = 12
	bottom.offset_right = -12
	hud_root.add_child(bottom)
	var bh := HBoxContainer.new()
	bh.add_theme_constant_override("separation", 10)
	bottom.add_child(bh)
	for i in range(TDData.TOWER_ORDER.size()):
		var key: String = TDData.TOWER_ORDER[i]
		var t: Dictionary = TDData.TOWERS[key]
		var b := mk_button("%s\n$%d" % [t["name"], t["cost"]], on_build.bind(key), Vector2(150, 62), 15)
		var tcol := Color(String(t["color"]))
		b.add_theme_stylebox_override("normal", sbox(Color(0.03, 0.06, 0.12, 0.96), tcol, 10, 3))
		tower_btns[key] = b
		b.gui_input.connect(on_tower_gui.bind(key))
		bh.add_child(b)
	var sep := VSeparator.new()
	bh.add_child(sep)
	skill_btns["misil"] = mk_button("Rayo", on_skill.bind("misil"), Vector2(112, 62), 15)
	skill_btns["radar"] = mk_button("Radar", on_skill.bind("radar"), Vector2(112, 62), 15)
	skill_btns["nuke"] = mk_button("Bomba", on_skill.bind("nuke"), Vector2(112, 62), 15)
	skill_btns["shield"] = mk_button("Escudo", on_skill.bind("shield"), Vector2(112, 62), 15)
	skill_btns["heal"] = mk_button("Botiquín", on_skill.bind("heal"), Vector2(112, 62), 15)
	for k in ["misil", "radar", "nuke", "shield", "heal"]:
		bh.add_child(skill_btns[k])
	bh.add_child(VSeparator.new())
	btn_wave = mk_button("▶ Oleada 1", on_start_wave, Vector2(170, 58), 18)
	bh.add_child(btn_wave)

func make_screen() -> Control:
	var c := Control.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.visible = false
	return c

func center_of(c: Control) -> CenterContainer:
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	cc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(cc)
	return cc

func build_menu() -> void:
	menu_root = Control.new()
	menu_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	menu_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(menu_root)
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.04, 0.08, 0.35)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	menu_root.add_child(shade)

	# Pantalla principal
	var s_main := make_screen()
	menu_root.add_child(s_main)
	screens["main"] = s_main
	var box := panel(Color(0.02, 0.05, 0.1, 0.88))
	box.custom_minimum_size = Vector2(440, 0)
	center_of(s_main).add_child(box)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	box.add_child(v)
	v.add_child(mk_label("TD DEFENSE", 56, COL_ACCENT))
	v.add_child(mk_label("Defensa militar futurista", 18, Color("#9fc6df")))
	v.add_child(mk_button("Jugar", func(): show_screen("maps"), Vector2(400, 50), 20))
	v.add_child(mk_button("Cómo jugar", func(): show_screen("help"), Vector2(400, 46), 18))
	v.add_child(mk_button("Salir", on_quit, Vector2(400, 46), 18))

	# Seleccion de escenario
	var s_maps := make_screen()
	menu_root.add_child(s_maps)
	screens["maps"] = s_maps
	var box2 := panel(Color(0.02, 0.05, 0.1, 0.9))
	center_of(s_maps).add_child(box2)
	var v2 := VBoxContainer.new()
	v2.add_theme_constant_override("separation", 14)
	box2.add_child(v2)
	v2.add_child(mk_label("Elige un escenario", 34, COL_ACCENT))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	v2.add_child(grid)
	for i in range(TDData.SCENARIOS.size()):
		var sc: Dictionary = TDData.SCENARIOS[i]
		grid.add_child(mk_button("%s\n%s" % [sc["name"], sc["desc"]], on_play.bind(i), Vector2(440, 96), 15))
	v2.add_child(mk_button("← Volver", func(): show_screen("main"), Vector2(200, 42), 16))

	# Como jugar
	var s_help := make_screen()
	menu_root.add_child(s_help)
	screens["help"] = s_help
	var box3 := panel(Color(0.02, 0.05, 0.1, 0.9))
	center_of(s_help).add_child(box3)
	var v3 := VBoxContainer.new()
	v3.add_theme_constant_override("separation", 12)
	box3.add_child(v3)
	v3.add_child(mk_label("Cómo jugar", 34, COL_ACCENT))
	var txt := mk_label("""Arrastra una torre desde la barra inferior hasta una casilla verde del mapa.
Haz clic en una torre construida para mejorarla (hasta nivel 3) o venderla.
Pulsa ▶ Oleada o Espacio para empezar. Los enemigos siguen la ruta hasta tu base.
Cada enemigo abatido da oro. Si pierdes todas las vidas, la base cae.
Habilidades: Rayo y Radar requieren un objetivo; Bomba, Escudo y Botiquín son inmediatas.

Controles con ratón:
· Arrastrar con el botón central: mover la cámara
· Rueda: zoom · Acercar el ratón a los bordes: desplazar
· Clic derecho: cancelar · Esc o P: pausa · 1–5: torres""", 16, COL_TEXT)
	txt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.custom_minimum_size = Vector2(680, 0)
	v3.add_child(txt)
	v3.add_child(mk_button("← Volver", func(): show_screen("main"), Vector2(200, 42), 16))
	show_screen("main")

func show_screen(which: String) -> void:
	for k in screens.keys():
		(screens[k] as Control).visible = (k == which)

func build_pause() -> void:
	pause_root = Control.new()
	pause_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_root.visible = false
	ui.add_child(pause_root)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_root.add_child(shade)
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_root.add_child(cc)
	var box := panel(Color(0.03, 0.06, 0.12, 0.95))
	box.custom_minimum_size = Vector2(320, 0)
	cc.add_child(box)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	box.add_child(v)
	v.add_child(mk_label("PAUSA", 36, COL_ACCENT))
	v.add_child(mk_button("Reanudar", toggle_pause, Vector2(280, 46), 18))
	v.add_child(mk_button("Reiniciar", on_restart, Vector2(280, 46), 18))
	v.add_child(mk_button("Menú Principal", on_menu, Vector2(280, 46), 18))

func build_end() -> void:
	end_root = Control.new()
	end_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	end_root.visible = false
	ui.add_child(end_root)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	end_root.add_child(shade)
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	end_root.add_child(cc)
	var box := panel(Color(0.03, 0.06, 0.12, 0.95))
	box.custom_minimum_size = Vector2(380, 0)
	cc.add_child(box)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	box.add_child(v)
	lbl_end_title = mk_label("", 40, COL_ACCENT)
	lbl_end_text = mk_label("", 18)
	v.add_child(lbl_end_title)
	v.add_child(lbl_end_text)
	v.add_child(mk_button("Jugar de nuevo", on_restart, Vector2(340, 46), 18))
	v.add_child(mk_button("Menú Principal", on_menu, Vector2(340, 46), 18))

func show_menu() -> void:
	in_game = false
	paused = false
	menu_root.visible = true
	show_screen("main")
	hud_root.visible = false
	pause_root.visible = false
	end_root.visible = false

func show_game() -> void:
	menu_root.visible = false
	hud_root.visible = true
	pause_root.visible = false
	end_root.visible = false

func msg(text: String) -> void:
	lbl_msg.text = text
	msg_t = 2.6
	lbl_msg.modulate.a = 1.0

# ====================== Menu / flujo ======================
func on_play(i: int) -> void:
	scen_index = i
	start_game()

func on_quit() -> void:
	get_tree().quit()

func on_menu() -> void:
	build_world(0)
	show_menu()

func on_restart() -> void:
	start_game()

func start_game() -> void:
	build_world(scen_index)
	reset_state()
	in_game = true
	show_game()
	msg("Coloca torres en las casillas verdes. Pulsa ▶ para empezar la oleada 1.")

func toggle_pause() -> void:
	if not in_game or over:
		return
	paused = not paused
	pause_root.visible = paused
	btn_pause.text = "Reanudar (Esc)" if paused else "Pausa (Esc)"

func toggle_speed() -> void:
	speed = 2.0 if speed < 1.5 else 1.0
	btn_speed.text = "Velocidad x%d" % int(speed)

func reset_state() -> void:
	var sc: Dictionary = TDData.SCENARIOS[scen_index]
	gold = TDData.START_GOLD
	lives = TDData.START_LIVES
	wave = 0
	kills = 0
	wave_active = false
	wave_time = 0.0
	wave_events = []
	towers = []
	tower_at = {}
	enemies = []
	dying = []
	projectiles = []
	strikes = []
	base_shield = 0.0
	shield_node = null
	build_type = ""
	skill_mode = ""
	selected = null
	speed = 1.0
	paused = false
	over = false
	btn_speed.text = "Velocidad x1"
	btn_pause.text = "Pausa (Esc)"
	for k in ["misil", "radar", "nuke", "shield", "heal"]:
		skill_cd[k] = 0.0
	pause_root.visible = false
	end_root.visible = false
	info_box.visible = false
	if sc.is_empty():
		push_error("Escenario vacio")

# ====================== Mundo / mapa ======================
func cell_pos(c: int, r: int) -> Vector3:
	return Vector3((c + 0.5) * TDData.TILE, 0.0, (r + 0.5) * TDData.TILE)

func get_tile(c: int, r: int) -> String:
	if r < 0 or r >= H or c < 0 or c >= W:
		return ""
	var row: String = grid[r]
	if c >= row.length():
		return "."
	return row.substr(c, 1)

func passable(c: int, r: int) -> bool:
	var t := get_tile(c, r)
	return t == "P" or t == "S" or t == "B"

func compute_path() -> Array:
	var prev: Dictionary = {spawn_cell: null}
	var q: Array = [spawn_cell]
	var qi := 0
	var found := false
	var dirs := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
	while qi < q.size():
		var cur: Vector2i = q[qi]
		qi += 1
		if cur == base_cell:
			found = true
			break
		for d in dirs:
			var nxt: Vector2i = cur + d
			if passable(nxt.x, nxt.y) and not prev.has(nxt):
				prev[nxt] = cur
				q.append(nxt)
	if not found:
		return []
	var path: Array = []
	var node: Variant = base_cell
	while node != null:
		path.push_front(node)
		node = prev[node]
	return path

# Redondea cada esquina dentro de la propia loseta, sin cruzar el terreno
# edificable. La longitud se calcula después a partir de estas muestras.
func smooth_path(cells: Array) -> Array:
	var result: Array = []
	if cells.is_empty():
		return result
	var centers: Array = []
	for cell in cells:
		var c: Vector2i = cell
		centers.append(cell_pos(c.x, c.y))
	result.append(centers[0])
	for i in range(1, centers.size() - 1):
		var previous: Vector3 = centers[i - 1]
		var corner: Vector3 = centers[i]
		var next: Vector3 = centers[i + 1]
		var incoming := (corner - previous).normalized()
		var outgoing := (next - corner).normalized()
		if incoming.dot(outgoing) > 0.999:
			result.append(corner)
			continue
		var radius := TDData.TILE * 0.28
		var entry := corner - incoming * radius
		var exit := corner + outgoing * radius
		result.append(entry)
		for step in range(1, 6):
			var t := float(step) / 5.0
			result.append(entry * (1.0 - t) * (1.0 - t) + corner * 2.0 * (1.0 - t) * t + exit * t * t)
	if centers.size() > 1:
		result.append(centers[-1])
	return result

func make_mat(hex: String) -> StandardMaterial3D:
	return TDModels.mat(hex)

func build_world(idx: int) -> void:
	scen_index = idx
	if world:
		world.queue_free()
	world = Node3D.new()
	add_child(world)
	var sc: Dictionary = TDData.SCENARIOS[idx]
	wind_props = []
	cell_props = {}
	spawn_cell = Vector2i.ZERO
	base_cell = Vector2i.ZERO
	grid = sc["grid"]
	H = grid.size()
	W = 0
	for row in grid:
		W = maxi(W, (row as String).length())
	# Localiza S y B y calcula la ruta
	for r in range(H):
		for c in range(W):
			var t := get_tile(c, r)
			if t == "S":
				spawn_cell = Vector2i(c, r)
			elif t == "B":
				base_cell = Vector2i(c, r)
	var path_cells := compute_path()
	path_pts = smooth_path(path_cells)
	path_len = []
	path_total = 0.0
	for i in range(path_pts.size()):
		if i > 0:
			path_total += (path_pts[i] as Vector3).distance_to(path_pts[i - 1])
		path_len.append(path_total)
	if path_pts.is_empty():
		push_error("No hay una ruta entre la entrada y la base en el escenario " + str(sc["name"]))
	base_pos = cell_pos(base_cell.x, base_cell.y)
	spawn_pos = cell_pos(spawn_cell.x, spawn_cell.y)
	air_total = Vector2(spawn_pos.x - base_pos.x, spawn_pos.z - base_pos.z).length()
	cam_target = Vector3(W * TDData.TILE * 0.5, 0, H * TDData.TILE * 0.5)
	cam_orbit = 0.0
	setup_environment(sc)
	build_terrain(sc)
	# Conservamos el suelo de fuego original como portal de entrada, sin
	# tapar toda la carretera ni ocultar las rutas de los cuatro mapas.
	var fire := TDModels.load_model("SueloFuego", TDData.TILE * 1.1)
	if fire != null:
		fire.position = spawn_pos + Vector3(0, 0.07, 0)
		world.add_child(fire)
	var hq := TDModels.build_hq()
	hq.position = base_pos
	world.add_child(hq)
	var spawn_node := TDModels.build_spawn()
	spawn_node.position = spawn_pos
	world.add_child(spawn_node)
	scatter_props(sc)
	sel_ring = make_ring(Color(0.3, 1.0, 0.6, 0.35))
	sel_ring.visible = false
	world.add_child(sel_ring)
	ghost_mat = StandardMaterial3D.new()
	ghost_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ghost_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ghost_mat.albedo_color = Color(0.3, 1.0, 0.5, 0.25)
	ghost_ring = MeshInstance3D.new()
	var gcm := CylinderMesh.new()
	gcm.top_radius = 1.0
	gcm.bottom_radius = 1.0
	gcm.height = 0.04
	gcm.radial_segments = 48
	ghost_ring.mesh = gcm
	ghost_ring.material_override = ghost_mat
	ghost_ring.visible = false
	world.add_child(ghost_ring)
	bar_mats = {}

func make_ring(color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.0
	cm.bottom_radius = 1.0
	cm.height = 0.04
	cm.radial_segments = 48
	mi.mesh = cm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = color
	mi.material_override = m
	return mi

func setup_environment(sc: Dictionary) -> void:
	# Reutilizar el cielo al cambiar de mapa evita crear texturas de entorno
	# adicionales cada vez que se reinicia una partida.
	var env: Environment = env_node.environment
	if env == null:
		env = Environment.new()
	var sky_res: Sky = env.sky
	if sky_res == null:
		sky_res = Sky.new()
	var sky := sky_res.sky_material as ProceduralSkyMaterial
	if sky == null:
		sky = ProceduralSkyMaterial.new()
		sky_res.sky_material = sky
	sky.sky_top_color = Color(sc["sky_top"])
	sky.sky_horizon_color = Color(sc["sky_bottom"])
	sky.ground_horizon_color = Color(sc["sky_bottom"]).darkened(0.3)
	sky.ground_bottom_color = Color(sc["ground"]).darkened(0.6)
	env.background_mode = Environment.BG_SKY
	env.sky = sky_res
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.8
	env.glow_enabled = true
	env.glow_intensity = 0.2
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 1.4
	env.fog_enabled = true
	env.fog_light_color = Color(sc["sky_bottom"]).darkened(0.25)
	env.fog_density = 0.0035
	env.ssao_enabled = true
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.05
	env.adjustment_contrast = 1.08
	env.adjustment_brightness = 0.95
	env_node.environment = env
	apply_quality()
	var night: bool = sc["id"] == "ciudad"
	sun.light_energy = 0.9 if night else 1.1
	sun.light_color = Color("#9fb4ff") if night else Color("#fff0d6")
	sun.rotation_degrees = Vector3(-50, 35, 0) if night else Vector3(-58, 30, 0)

func terrain_material(color: Color, strength: float = 0.035) -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = TERRAIN_SHADER
	material.set_shader_parameter("ground_color", color)
	material.set_shader_parameter("wind_strength", strength)
	return material

func build_terrain(sc: Dictionary) -> void:
	var base_col := Color(sc["ground"])
	var variants := [terrain_material(base_col.darkened(0.03)), terrain_material(base_col.darkened(0.06)), terrain_material(base_col)]
	var road_mat := terrain_material(Color(sc["road"]), 0.006)
	var water_mat := ShaderMaterial.new()
	water_mat.shader = WATER_SHADER
	water_mat.set_shader_parameter("water_color", Color(sc["water"]))
	var water_mesh := PlaneMesh.new()
	water_mesh.size = Vector2(TDData.TILE, TDData.TILE)
	water_mesh.subdivide_width = 6
	water_mesh.subdivide_depth = 6
	var deco: Array = sc["deco"]
	# El exterior se encuentra justo debajo del tablero, sin parpadeos.
	TDModels.box(world, Vector3(260, 0.4, 260), terrain_material(base_col.darkened(0.35)), Vector3(W * TDData.TILE * 0.5, -0.29, H * TDData.TILE * 0.5))
	for r in range(H):
		for c in range(W):
			var t := get_tile(c, r)
			var p := cell_pos(c, r)
			if t == "~":
				var water := MeshInstance3D.new()
				water.mesh = water_mesh
				water.material_override = water_mat
				water.position = p + Vector3(0, 0.015, 0)
				water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				world.add_child(water)
				continue
			TDModels.box(world, Vector3(TDData.TILE, 0.4, TDData.TILE), variants[rng.randi() % variants.size()], Vector3(p.x, -0.2, p.z))
			if t == "P" or t == "S" or t == "B":
				TDModels.box(world, Vector3(TDData.TILE, 0.06, TDData.TILE), road_mat, Vector3(p.x, 0.03, p.z))
				# Marcas discretas en los tramos rectos facilitan leer la ruta.
				var horizontal := passable(c - 1, r) and passable(c + 1, r)
				var vertical := passable(c, r - 1) and passable(c, r + 1)
				if horizontal != vertical:
					var size := Vector3(0.66, 0.01, 0.055) if horizontal else Vector3(0.055, 0.01, 0.66)
					TDModels.box(world, size, make_mat("#b3ad90"), p + Vector3(0, 0.069, 0))
			elif t == "#":
				build_obstacle(sc, p)
			elif t == "." and rng.randf() < 0.22 and not deco.is_empty():
				var kind: String = deco[rng.randi() % deco.size()]
				add_scenery(kind, p + Vector3(rng.randf_range(-0.4, 0.4), 0, rng.randf_range(-0.4, 0.4)), Vector2i(c, r))
	build_grass(sc)

func build_obstacle(sc: Dictionary, p: Vector3) -> void:
	if sc["id"] != "ciudad":
		# Montañas y mesetas, en vez de edificios repetidos en todos los biomas.
		var kind := "snowrock" if sc["id"] == "montana" else "rock"
		var rock := TDModels.build_prop(kind, rng)
		rock.position = p
		rock.scale *= rng.randf_range(1.4, 1.9)
		world.add_child(rock)
		return
	var h := rng.randf_range(1.6, 3.4)
	var bcols: Array = ["#8d8a80", "#a39a86", "#6f7480"]
	TDModels.box(world, Vector3(TDData.TILE * 0.86, h, TDData.TILE * 0.86), make_mat(bcols[rng.randi() % 3]), Vector3(p.x, h / 2.0, p.z))
	TDModels.box(world, Vector3(TDData.TILE * 0.9, 0.15, TDData.TILE * 0.9), TDModels.glow("#44c8ff", 0.8), Vector3(p.x, h + 0.08, p.z))
	var half := TDData.TILE * 0.43
	for fy in [0.4, 0.75]:
		var yy: float = h * float(fy)
		var win := TDModels.glow("#ffd9a0", 0.9)
		TDModels.box(world, Vector3(TDData.TILE * 0.7, 0.14, 0.04), win, Vector3(p.x, yy, p.z + half))
		TDModels.box(world, Vector3(TDData.TILE * 0.7, 0.14, 0.04), win, Vector3(p.x, yy, p.z - half))
		TDModels.box(world, Vector3(0.04, 0.14, TDData.TILE * 0.7), win, Vector3(p.x + half, yy, p.z))
		TDModels.box(world, Vector3(0.04, 0.14, TDData.TILE * 0.7), win, Vector3(p.x - half, yy, p.z))

func add_scenery(kind: String, pos: Vector3, cell: Vector2i = Vector2i(-1, -1)) -> void:
	var prop := TDModels.build_prop(kind, rng)
	prop.position = pos
	world.add_child(prop)
	if cell.x >= 0:
		cell_props[cell] = prop
	if kind in ["pine", "broadleaf", "palm"]:
		wind_props.append({"node": prop, "rotation": prop.rotation, "phase": rng.randf_range(0.0, TAU)})

func scatter_props(sc: Dictionary) -> void:
	var deco: Array = sc["deco"]
	if deco.is_empty():
		return
	var span_x := W * TDData.TILE
	var span_z := H * TDData.TILE
	var placed := 0
	var tries := 0
	while placed < 70 and tries < 800:
		tries += 1
		var x := rng.randf_range(-14.0, span_x + 14.0)
		var z := rng.randf_range(-14.0, span_z + 14.0)
		if x > -2 and x < span_x + 2 and z > -2 and z < span_z + 2:
			continue
		var kind: String = deco[rng.randi() % deco.size()]
		add_scenery(kind, Vector3(x, 0, z))
		placed += 1

func build_grass(sc: Dictionary) -> void:
	if sc["id"] == "ciudad":
		return
	var transforms: Array = []
	for r in range(H):
		for c in range(W):
			if get_tile(c, r) != "." or rng.randf() > 0.6:
				continue
			var center := cell_pos(c, r)
			for i in range(3):
				var scale_ := rng.randf_range(0.7, 1.25)
				var origin := center + Vector3(rng.randf_range(-0.85, 0.85), 0.275 * scale_, rng.randf_range(-0.85, 0.85))
				var basis := Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(Vector3.ONE * scale_)
				transforms.append(Transform3D(basis, origin))
	if transforms.is_empty():
		return
	var blade := QuadMesh.new()
	blade.size = Vector2(0.16, 0.55)
	var grass_mat := ShaderMaterial.new()
	grass_mat.shader = GRASS_SHADER
	var color := Color(sc["ground"]).darkened(0.2)
	if sc["id"] == "desierto":
		color = Color("#aa924d")
	grass_mat.set_shader_parameter("grass_color", color)
	blade.material = grass_mat
	var multi := MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.mesh = blade
	multi.instance_count = transforms.size()
	for i in range(transforms.size()):
		multi.set_instance_transform(i, transforms[i])
	var grass := MultiMeshInstance3D.new()
	grass.name = "HierbaConViento"
	grass.multimesh = multi
	grass.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(grass)

func update_wind(delta: float) -> void:
	wind_time += delta
	var living: Array = []
	for item in wind_props:
		var prop: Node3D = item["node"]
		if not is_instance_valid(prop) or prop.is_queued_for_deletion():
			continue
		var original: Vector3 = item["rotation"]
		var phase: float = item["phase"]
		prop.rotation.x = original.x + sin(wind_time * 1.0 + phase) * 0.018
		prop.rotation.z = original.z + sin(wind_time * 1.25 + phase) * 0.028
		living.append(item)
	wind_props = living

# ====================== Oleadas ======================
func on_start_wave() -> void:
	if not in_game or over or wave_active or wave >= TDData.MAX_WAVE or paused:
		return
	wave += 1
	wave_events = TDData.build_wave(wave)
	wave_time = 0.0
	wave_active = true
	msg("Oleada %d iniciada" % wave)

func end_wave() -> void:
	wave_active = false
	var bonus := 60 + wave * 12
	gold += bonus
	TDFx.float_text(world, base_pos + Vector3(0, 5, 0), "+$%d oleada" % bonus, COL_GOLD)
	msg("Oleada %d superada (+$%d)" % [wave, bonus])
	if wave >= TDData.MAX_WAVE:
		win()

func win() -> void:
	over = true
	lbl_end_title.text = "¡VICTORIA!"
	lbl_end_title.add_theme_color_override("font_color", Color("#7dff7a"))
	lbl_end_text.text = "Has defendido la base en las %d oleadas.\nBajas: %d · Vidas: %d" % [TDData.MAX_WAVE, kills, lives]
	end_root.visible = true

func lose() -> void:
	over = true
	lbl_end_title.text = "DERROTA"
	lbl_end_title.add_theme_color_override("font_color", COL_WARN)
	lbl_end_text.text = "La base ha caído en la oleada %d.\nBajas: %d" % [wave, kills]
	end_root.visible = true

func spawn_enemy(type: String, boss: bool) -> void:
	var info: Dictionary = TDData.ENEMIES[type]
	var node := TDModels.build_enemy(type)
	if boss:
		node.scale = Vector3.ONE * 1.7
	var air: bool = info["air"]
	var mult := 1.0 + (wave - 1) * 0.12
	var hp: float = float(info["hp"]) * mult * (4.0 if boss else 1.0)
	var pos := spawn_pos
	pos.y = AIR_Y if air else 0.0
	node.position = pos
	var direction := base_pos - spawn_pos
	if not air and path_pts.size() > 1:
		direction = (path_pts[1] as Vector3) - (path_pts[0] as Vector3)
	if direction.length_squared() > 0.0001:
		node.rotation.y = atan2(-direction.x, -direction.z)
	world.add_child(node)
	var bar := make_bar(boss)
	world.add_child(bar)
	var e := {
		"type": type, "node": node, "bar": bar, "air": air, "boss": boss,
		"hp": hp, "maxhp": hp, "armor": float(info["armor"]),
		"speed": float(info["speed"]) * rng.randf_range(0.94, 1.06) * (0.9 if boss else 1.0),
		"dmg": 15 if boss else int(info["dmg"]),
		"reward": 150 if boss else int(info["reward"]),
		"d": 0.0, "pos": pos, "lane": rng.randf_range(-0.28, 0.28),
		"slow": 0.0, "dead": false, "t": rng.randf() * 6.0, "gait": rng.randf() * TAU,
	}
	enemies.append(e)

func bar_material(color: Color) -> StandardMaterial3D:
	var key := color.to_html(false)
	if bar_mats.has(key):
		return bar_mats[key]
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.no_depth_test = true
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = color
	bar_mats[key] = m
	return m

func make_bar(boss: bool) -> Node3D:
	var b := Node3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.2, 0.14)
	var bg := MeshInstance3D.new()
	bg.mesh = q
	bg.material_override = bar_material(Color(0.05, 0.05, 0.05, 0.75))
	b.add_child(bg)
	var fg := MeshInstance3D.new()
	fg.mesh = q
	fg.name = "fg"
	fg.material_override = bar_material(Color("#ff3b30") if boss else Color("#6dff6a"))
	fg.position = Vector3(0, 0, 0.01)
	b.add_child(fg)
	if boss:
		b.scale = Vector3.ONE * 2.0
	return b

func enemy_pos_on_path(d: float) -> Vector3:
	var n := path_pts.size()
	if n == 0:
		return spawn_pos
	if d <= 0.0 or n == 1:
		return path_pts[0]
	for i in range(n - 1):
		var s0: float = path_len[i]
		var s1: float = path_len[i + 1]
		if d <= s1:
			var t := (d - s0) / maxf(0.0001, s1 - s0)
			return (path_pts[i] as Vector3).lerp(path_pts[i + 1], t)
	return path_pts[n - 1]

func update_enemies(dt: float) -> void:
	for e in enemies:
		if e["dead"]:
			continue
		e["t"] = float(e["t"]) + dt
		var slow := 1.0
		var sl: float = e["slow"]
		if sl > 0.0:
			slow = 0.5
		e["slow"] = maxf(0.0, sl - dt)
		var step: float = float(e["speed"]) * slow * dt
		var d: float = float(e["d"]) + step
		e["d"] = d
		e["gait"] = float(e["gait"]) + step
		var air: bool = e["air"]
		var node: Node3D = e["node"]
		var pos := Vector3.ZERO
		var direction := Vector3.ZERO
		if air:
			if d >= air_total - 1.5:
				reach_base(e)
				continue
			var k := clampf(d / maxf(0.001, air_total), 0.0, 1.0)
			pos = spawn_pos.lerp(base_pos, k)
			pos.y = AIR_Y + sin(float(e["t"]) * 3.0) * 0.15
			direction = (base_pos - spawn_pos).normalized()
		else:
			if d >= path_total:
				reach_base(e)
				continue
			# La tangente anticipa el giro de la ruta redondeada. El pequeño
			# desplazamiento lateral sigue la ruta en vez de cortar las curvas.
			var ahead := enemy_pos_on_path(minf(d + 0.32, path_total))
			var behind := enemy_pos_on_path(maxf(d - 0.18, 0.0))
			direction = (ahead - behind).normalized()
			var side := Vector3(-direction.z, 0, direction.x)
			var fade := minf(clampf(d / TDData.TILE, 0.0, 1.0), clampf((path_total - d) / TDData.TILE, 0.0, 1.0))
			pos = enemy_pos_on_path(d) + side * float(e["lane"]) * fade
		e["pos"] = pos
		node.position = pos
		if direction.length_squared() > 0.0001:
			var heading := atan2(-direction.x, -direction.z)
			node.rotation.y = lerp_angle(node.rotation.y, heading, 1.0 - exp(-dt * 12.0))
		animate_enemy(e, dt)

func animate_enemy(e: Dictionary, dt: float) -> void:
	var node: Node3D = e["node"]
	var t: float = e["t"]
	var gait: float = e["gait"]
	var type: String = e["type"]
	if node.has_meta("body"):
		var body: Node3D = node.get_meta("body")
		if e["air"]:
			body.rotation.z = sin(t * 2.0) * 0.045
			body.rotation.x = sin(t * 1.4) * 0.025
		elif type in ["soldier", "shield", "spider"]:
			# Los GLB originales son mallas sin esqueleto: se anima el cuerpo
			# completo sin inventar huesos ni sustituir el modelo del autor.
			body.position.y = absf(sin(gait * 3.0)) * 0.065
			body.rotation.z = sin(gait * 3.0) * 0.055
			body.rotation.x = sin(gait * 6.0) * 0.025
		else:
			body.position.y = absf(sin(gait * 2.0)) * 0.025
			body.rotation.z = sin(gait * 1.7) * 0.018
	if node.has_meta("legs"):
		var legs: Array = node.get_meta("legs")
		for i in range(legs.size()):
			var lg: Node3D = legs[i]
			if type == "spider":
				lg.rotation.y = sin(gait * 5.0 + float(i) * 0.9) * 0.25
			else:
				lg.rotation.x = sin(gait * 3.0 + float(i) * PI) * 0.5
	if node.has_meta("rotors"):
		var rotors: Array = node.get_meta("rotors")
		for rt in rotors:
			var r3: Node3D = rt
			r3.rotation.y += dt * 25.0

func reach_base(e: Dictionary) -> void:
	if e["dead"]:
		return
	e["dead"] = true
	remove_bar(e)
	if base_shield > 0.0:
		TDFx.float_text(world, base_pos + Vector3(0, 4.5, 0), "BLOQUEADO", Color("#7fe9ff"))
	else:
		lives -= int(e["dmg"])
		TDFx.float_text(world, base_pos + Vector3(0, 4.5, 0), "-%d VIDA" % int(e["dmg"]), COL_WARN)
		TDFx.explosion(world, base_pos + Vector3(0, 0.5, 0), 0.8)
		flash_screen(Color(1, 0.2, 0.1, 0.25), 0.25)
	var node: Node3D = e["node"]
	if node and is_instance_valid(node):
		node.queue_free()
	if lives <= 0 and not over:
		lives = 0
		lose()

func remove_bar(e: Dictionary) -> void:
	var bar: Node3D = e["bar"]
	if bar and is_instance_valid(bar):
		bar.queue_free()
	e["bar"] = null

func damage(e: Dictionary, amount: float) -> void:
	if e["dead"]:
		return
	var armor: float = e["armor"]
	var d := amount * (1.0 - armor)
	e["hp"] = float(e["hp"]) - d
	if float(e["hp"]) <= 0.0:
		kill(e)

func kill(e: Dictionary) -> void:
	if e["dead"]:
		return
	e["dead"] = true
	gold += int(e["reward"])
	kills += 1
	remove_bar(e)
	var pos: Vector3 = e["pos"]
	var node: Node3D = e["node"]
	TDFx.float_text(world, pos + Vector3(0, 1.8, 0), "+$%d" % int(e["reward"]), COL_GOLD)
	var boss: bool = e["boss"]
	var air: bool = e["air"]
	TDFx.explosion(world, pos, 3.0 if boss else 0.9, Color(0.5, 0.9, 1.0) if air else Color(1.0, 0.55, 0.12))
	if boss:
		flash_screen(Color(1, 0.8, 0.5, 0.2), 0.3)
	dying.append({"node": node, "t": 0.9, "base_y": pos.y, "dir": 1.0 if rng.randf() < 0.5 else -1.0})

func update_dying(dt: float) -> void:
	var keep: Array = []
	for d in dying:
		var t: float = d["t"] - dt
		var node: Node3D = d["node"]
		if t <= 0.0 or not is_instance_valid(node):
			if is_instance_valid(node):
				node.queue_free()
			continue
		d["t"] = t
		var k := 1.0 - t / 0.9
		node.rotation.z = lerpf(0.0, float(d["dir"]) * PI / 2.0, minf(1.0, k * 1.6))
		node.position.y = lerpf(float(d["base_y"]), -0.25, k)
		if randf() < dt * 14.0:
			TDFx.smoke(world, node.global_position + Vector3(0, 0.4, 0), 3, Color(0.25, 0.25, 0.27, 0.7), 0.7)
		keep.append(d)
	dying = keep

func update_bars() -> void:
	for e in enemies:
		if e["dead"] or e["bar"] == null:
			continue
		var bar: Node3D = e["bar"]
		var pos: Vector3 = e["pos"]
		var h := 2.1
		if e["boss"]:
			h = 3.0
		bar.position = pos + Vector3(0, h, 0)
		var ratio := clampf(float(e["hp"]) / float(e["maxhp"]), 0.0, 1.0)
		var fg: Node3D = bar.get_node("fg")
		fg.scale = Vector3(maxf(0.001, ratio), 1, 1)
		fg.position.x = -0.6 * (1.0 - ratio)

# ====================== Torres ======================
func tower_stats(t: Dictionary) -> Dictionary:
	var base: Dictionary = TDData.TOWERS[t["type"]]
	var lv: int = int(t["level"]) - 1
	return {
		"dmg": float(base["dmg"]) * (1.0 + 0.45 * lv),
		"rate": float(base["rate"]) * (1.0 - 0.2 * lv),
		"range": float(base["range"]) + 0.6 * lv,
		"splash": float(base.get("splash", 0.0)),
		"ground": bool(base["ground"]),
		"air": bool(base["air"]),
		"chain": int(base.get("chain", 0)),
	}

func find_target(p: Vector3, range_: float, ground: bool, air: bool) -> Variant:
	var best: Variant = null
	var best_remaining := INF
	for e in enemies:
		if e["dead"]:
			continue
		var is_air: bool = e["air"]
		if is_air and not air:
			continue
		if not is_air and not ground:
			continue
		var ep: Vector3 = e["pos"]
		var dist := Vector2(ep.x - p.x, ep.z - p.z).length()
		if dist > range_:
			continue
		# Una ruta aérea y una terrestre tienen longitudes diferentes: se
		# prioriza la distancia restante hasta la base, no la recorrida.
		var total := air_total if is_air else path_total
		var remaining := total - float(e["d"])
		if remaining < best_remaining:
			best_remaining = remaining
			best = e
	return best

func update_towers(dt: float) -> void:
	for t in towers:
		t["cd"] = float(t["cd"]) - dt
		t["recoil"] = maxf(0.0, float(t["recoil"]) - dt * 6.0)
		var turret: Node3D = t["turret"]
		var origin: Vector3 = t["turret_origin"]
		# Retroceso en la dirección real de la torre, no en un eje fijo del mapa.
		turret.position = origin + turret.basis.z.normalized() * float(t["recoil"]) * 0.12
		var st := tower_stats(t)
		var target: Variant = find_target(t["pos"], st["range"], st["ground"], st["air"])
		if target == null:
			continue
		var tp: Vector3 = target["pos"]
		var tpos: Vector3 = t["pos"]
		var want := atan2(-(tp.x - tpos.x), -(tp.z - tpos.z))
		turret.rotation.y = lerp_angle(turret.rotation.y, want, minf(1.0, dt * 12.0))
		var diff := absf(angle_difference(turret.rotation.y, want))
		if float(t["cd"]) <= 0.0 and diff < 0.3:
			fire(t, st, target)
			t["cd"] = st["rate"]

func muzzle_pos(t: Dictionary) -> Vector3:
	var turret: Node3D = t["turret"]
	return turret.global_position - turret.global_transform.basis.z.normalized() * 0.8 + Vector3(0, 1.1, 0)

func fire(t: Dictionary, st: Dictionary, target: Dictionary) -> void:
	var kind: String = t["type"]
	var tp: Vector3 = target["pos"]
	var aim := tp + Vector3(0, 0.5 if target["air"] else 0.6, 0)
	var mz := muzzle_pos(t)
	t["recoil"] = 1.0
	match kind:
		"mg":
			TDFx.flash(world, mz, Color(1, 0.8, 0.4, 1), 0.5, 0.05)
			TDFx.beam(world, mz, aim, Color(1.0, 0.8, 0.45, 1.0), 0.03, 0.06)
			damage(target, st["dmg"])
			TDFx.sparks(world, aim, 4, Color(1, 0.75, 0.35), 2.5)
		"laser":
			TDFx.flash(world, mz, Color(0.4, 0.9, 1.0, 1), 0.7, 0.08)
			TDFx.beam(world, mz, aim, Color(0.3, 0.85, 1.0, 1.0), 0.09, 0.14)
			damage(target, st["dmg"])
			TDFx.sparks(world, aim, 6, Color(0.5, 0.9, 1.0), 3.0)
		"aa":
			TDFx.flash(world, mz, Color(1, 0.85, 0.4, 1), 0.8, 0.07)
			TDFx.beam(world, mz, aim, Color(1, 0.9, 0.5, 1), 0.05, 0.1)
			area_damage(aim, st["splash"], st["dmg"], true, false)
			TDFx.explosion(world, aim, 0.5, Color(1, 0.8, 0.3))
		"missile":
			TDFx.flash(world, mz, Color(1, 0.6, 0.3, 1), 0.9, 0.08)
			var node := TDModels.build_missile()
			node.position = mz
			world.add_child(node)
			projectiles.append({"node": node, "target": target, "aim": aim, "speed": 16.0, "dmg": st["dmg"], "splash": st["splash"], "trail": 0.0, "life": 4.0})
		"tesla":
			TDFx.flash(world, mz, Color(0.5, 0.95, 1, 1), 0.6, 0.06)
			var hit: Array = [target]
			damage(target, st["dmg"])
			var prev := mz
			var cur_pos := aim
			TDFx.beam(world, prev, cur_pos, Color(0.6, 0.95, 1, 1), 0.04, 0.2)
			var chain: int = st["chain"]
			for i in range(chain - 1):
				var nxt: Variant = nearest_enemy(cur_pos, 4.0, hit)
				if nxt == null:
					break
				hit.append(nxt)
				var np: Vector3 = nxt["pos"]
				var np_aim := np + Vector3(0, 0.5, 0)
				damage(nxt, st["dmg"] * 0.8)
				TDFx.beam(world, cur_pos, np_aim, Color(0.6, 0.95, 1, 1), 0.04, 0.2)
				TDFx.sparks(world, np_aim, 6, Color(0.6, 0.95, 1), 3.5)
				cur_pos = np_aim
			TDFx.sparks(world, aim, 8, Color(0.6, 0.95, 1), 4.0)

func nearest_enemy(p: Vector3, radius: float, exclude: Array) -> Variant:
	var best: Variant = null
	var best_d := radius
	for e in enemies:
		if e["dead"] or exclude.has(e):
			continue
		var ep: Vector3 = e["pos"]
		var dd := Vector2(ep.x - p.x, ep.z - p.z).length()
		if dd <= best_d:
			best_d = dd
			best = e
	return best

func area_damage(center: Vector3, radius: float, amount: float, air_ok: bool, ground_ok: bool) -> void:
	for e in enemies:
		if e["dead"]:
			continue
		var is_air: bool = e["air"]
		if is_air and not air_ok:
			continue
		if not is_air and not ground_ok:
			continue
		var ep: Vector3 = e["pos"]
		if Vector2(ep.x - center.x, ep.z - center.z).length() <= radius:
			damage(e, amount)

func update_projectiles(dt: float) -> void:
	for p in projectiles:
		var node: Node3D = p["node"]
		var target: Variant = p["target"]
		if target != null and not target["dead"]:
			var tp: Vector3 = target["pos"]
			p["aim"] = tp + Vector3(0, 0.5 if target["air"] else 0.6, 0)
		var aim: Vector3 = p["aim"]
		var to := aim - node.position
		var dist := to.length()
		var step := float(p["speed"]) * dt
		if dist <= step + 0.2:
			area_damage(aim, float(p["splash"]), float(p["dmg"]), false, true)
			TDFx.explosion(world, aim, 0.9)
			p["life"] = -1.0
		else:
			node.position += to / dist * step
			if to.length() > 0.01:
				node.look_at(aim, Vector3.UP)
			p["trail"] = float(p["trail"]) - dt
			if float(p["trail"]) <= 0.0:
				p["trail"] = 0.06
				TDFx.smoke(world, node.position, 2, Color(0.8, 0.8, 0.8, 0.6), 0.5)
		p["life"] = float(p["life"]) - dt
	var keep: Array = []
	for p in projectiles:
		if float(p["life"]) <= 0.0:
			var node: Node3D = p["node"]
			if is_instance_valid(node):
				node.queue_free()
		else:
			keep.append(p)
	projectiles = keep

func update_strikes(dt: float) -> void:
	var keep: Array = []
	for s in strikes:
		s["t"] = float(s["t"]) - dt
		if float(s["t"]) <= 0.0:
			var aim: Vector3 = s["aim"]
			# Rayo: columna de luz desde el cielo + destello y chispas
			var top := aim + Vector3(rng.randf_range(-0.8, 0.8), 14.0, rng.randf_range(-0.8, 0.8))
			TDFx.beam(world, top, aim + Vector3(0, 0.3, 0), Color(0.75, 0.9, 1.0, 1.0), 0.18, 0.25)
			TDFx.beam(world, top, aim + Vector3(0, 0.3, 0), Color(0.4, 0.7, 1.0, 0.6), 0.45, 0.25)
			TDFx.flash(world, aim + Vector3(0, 0.4, 0), Color(0.8, 0.95, 1, 1), 2.0, 0.15)
			TDFx.sparks(world, aim + Vector3(0, 0.3, 0), 16, Color(0.7, 0.9, 1.0), 6.0)
			TDFx.explosion(world, aim, 0.7, Color(0.6, 0.8, 1.0))
			area_damage(aim, float(s["splash"]), float(s["dmg"]), true, true)
		else:
			keep.append(s)
	strikes = keep

# ====================== Construccion y venta ======================
func pick_point(mp: Vector2) -> Variant:
	var o := cam.project_ray_origin(mp)
	var d := cam.project_ray_normal(mp)
	if absf(d.y) < 0.0001:
		return null
	var t := -o.y / d.y
	return o + d * t

func pick_cell(mp: Vector2) -> Vector2i:
	var p: Variant = pick_point(mp)
	if p == null:
		return Vector2i(-1, -1)
	var pv: Vector3 = p
	var c := int(floor(pv.x / TDData.TILE))
	var r := int(floor(pv.z / TDData.TILE))
	if c < 0 or r < 0 or c >= W or r >= H:
		return Vector2i(-1, -1)
	return Vector2i(c, r)

func can_build(c: int, r: int) -> bool:
	return get_tile(c, r) == "." and not tower_at.has(Vector2i(c, r))

func on_build(key: String) -> void:
	if Engine.get_process_frames() == drag_release_frame:
		return
	if not in_game or over or paused:
		return
	skill_mode = ""
	build_type = "" if build_type == key else key
	selected = null
	info_box.visible = false
	if build_type != "":
		msg("Haz clic en una casilla verde para colocar: %s (clic derecho cancela)" % TDData.TOWERS[key]["name"])

func place_tower(key: String, cell: Vector2i) -> void:
	var info: Dictionary = TDData.TOWERS[key]
	var cost: int = info["cost"]
	if not can_build(cell.x, cell.y):
		msg("No se puede construir aquí")
		return
	if gold < cost:
		msg("Oro insuficiente")
		return
	gold -= cost
	if cell_props.has(cell):
		var prop: Node3D = cell_props[cell]
		if is_instance_valid(prop):
			prop.queue_free()
		cell_props.erase(cell)
	var pos := cell_pos(cell.x, cell.y)
	var root := TDModels.build_tower(key, 1)
	root.position = pos
	root.scale = Vector3.ONE * 0.1
	world.add_child(root)
	var tw := root.create_tween()
	tw.tween_property(root, "scale", Vector3.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var turret: Node3D = root.get_meta("turret")
	var t := {"type": key, "level": 1, "cell": cell, "pos": pos, "node": root, "turret": turret,
		"turret_origin": turret.position, "cd": 0.4, "spent": cost, "recoil": 0.0}
	towers.append(t)
	tower_at[cell] = t
	TDFx.smoke(world, pos + Vector3(0, 0.3, 0), 12, Color(0.5, 0.5, 0.5, 0.6), 1.0)
	TDFx.float_text(world, pos + Vector3(0, 2.5, 0), "-$%d" % cost, COL_WARN, 32)

func rebuild_tower(t: Dictionary) -> void:
	var old: Node3D = t["node"]
	var pos: Vector3 = t["pos"]
	var old_turret: Node3D = t["turret"]
	var heading := old_turret.rotation.y
	var root := TDModels.build_tower(t["type"], int(t["level"]))
	root.position = pos
	world.add_child(root)
	if is_instance_valid(old):
		old.queue_free()
	var turret: Node3D = root.get_meta("turret")
	turret.rotation.y = heading
	t["node"] = root
	t["turret"] = turret
	t["turret_origin"] = turret.position

func on_upgrade() -> void:
	if selected == null or over or paused:
		return
	var t: Dictionary = selected
	if int(t["level"]) >= 3:
		msg("Nivel máximo alcanzado")
		return
	var cost: int = TDData.UPGRADE_COST[int(t["level"]) - 1]
	if gold < cost:
		msg("Oro insuficiente para mejorar")
		return
	gold -= cost
	t["spent"] = int(t["spent"]) + cost
	t["level"] = int(t["level"]) + 1
	rebuild_tower(t)
	TDFx.float_text(world, t["pos"] + Vector3(0, 3, 0), "NIVEL %d" % int(t["level"]), COL_GOLD)
	TDFx.burst(world, t["pos"] + Vector3(0, 0.6, 0), Color(1, 0.8, 0.4), 30, 4.0, 0.3, 0.6, true, -2.0)

func on_sell() -> void:
	if selected == null or over or paused:
		return
	var t: Dictionary = selected
	var refund := int(floor(int(t["spent"]) * 0.6))
	gold += refund
	var node: Node3D = t["node"]
	if is_instance_valid(node):
		TDFx.smoke(world, node.position + Vector3(0, 0.6, 0), 14, Color(0.4, 0.4, 0.42, 0.7), 1.2)
		node.queue_free()
	towers.erase(t)
	tower_at.erase(t["cell"])
	TDFx.float_text(world, t["pos"] + Vector3(0, 2.5, 0), "+$%d" % refund, COL_GOLD, 32)
	selected = null
	info_box.visible = false
	sel_ring.visible = false

func select_at(cell: Vector2i) -> void:
	if tower_at.has(cell):
		selected = tower_at[cell]
	else:
		selected = null

func update_towers_info() -> void:
	if selected == null or not towers.has(selected):
		selected = null
		info_box.visible = false
		sel_ring.visible = false
		return
	var t: Dictionary = selected
	var info: Dictionary = TDData.TOWERS[t["type"]]
	var st := tower_stats(t)
	info_box.visible = true
	info_title.text = "%s · Nivel %d" % [info["name"], int(t["level"])]
	var lines := "Daño: %d\nCadencia: %.2fs\nAlcance: %.1f" % [int(round(st["dmg"])), st["rate"], st["range"]]
	if int(t["level"]) < 3:
		lines += "\nMejora: $%d" % TDData.UPGRADE_COST[int(t["level"]) - 1]
	else:
		lines += "\nNivel máximo"
	lines += "\nVenta: $%d" % int(floor(int(t["spent"]) * 0.6))
	info_stats.text = lines
	btn_up.disabled = int(t["level"]) >= 3
	btn_sell.disabled = false
	sel_ring.visible = true
	sel_ring.position = Vector3(t["pos"].x, 0.1, t["pos"].z)
	sel_ring.scale = Vector3(st["range"], 1, st["range"])

# ====================== Habilidades ======================
func on_skill(skill: String) -> void:
	if not in_game or over or paused:
		return
	if float(skill_cd[skill]) > 0.0:
		msg("Habilidad en enfriamiento (%ds)" % int(ceil(float(skill_cd[skill]))))
		return
	if skill == "misil" or skill == "radar":
		skill_mode = "" if skill_mode == skill else skill
		build_type = ""
		msg("Haz clic en el objetivo (Esc cancela)" if skill_mode != "" else "Habilidad cancelada")
		return
	if skill == "nuke":
		skill_cd["nuke"] = TDData.SKILL_CD["nuke"]
		TDFx.ring(world, base_pos + Vector3(0, 0.2, 0), 34, Color(1, 0.25, 0.2), 1.2)
		TDFx.ring(world, base_pos + Vector3(0, 0.2, 0), 20, Color(1, 0.9, 0.4), 0.9)
		TDFx.flash(world, base_pos + Vector3(0, 3, 0), Color(1, 1, 1, 1), 12.0, 0.5)
		for i in range(12):
			var p := base_pos + Vector3(rng.randf_range(-15, 15), 0, rng.randf_range(-15, 15))
			TDFx.explosion(world, p, 2.4)
		TDFx.smoke(world, base_pos + Vector3(0, 4, 0), 40, Color(0.7, 0.7, 0.72, 0.7), 3.0)
		flash_screen(Color(1, 1, 1, 0.85), 1.2)
		for e in enemies:
			damage(e, 260.0)
		msg("¡Ataque nuclear!")
	elif skill == "shield":
		skill_cd["shield"] = TDData.SKILL_CD["shield"]
		base_shield = 10.0
		if shield_node == null or not is_instance_valid(shield_node):
			var sm := TDModels.load_model("Escudo", 6.0)
			if sm != null:
				shield_node = sm
				sm.position = base_pos + Vector3(0, 0.2, 0)
				world.add_child(sm)
			else:
				shield_node = TDModels.sph(world, 3.2, TDModels.glow("#44c8ff", 0.8), base_pos + Vector3(0, 1.5, 0))
				shield_node.material_override = bar_material(Color(0.3, 0.8, 1.0, 0.18))
		msg("Escudo de base activo (10s)")
	elif skill == "heal":
		skill_cd["heal"] = TDData.SKILL_CD["heal"]
		lives = mini(TDData.START_LIVES, lives + 25)
		TDFx.float_text(world, base_pos + Vector3(0, 4.5, 0), "+25 VIDA", Color("#7dff7a"))
		TDFx.sparks(world, base_pos + Vector3(0, 2, 0), 40, Color(0.5, 1, 0.5), 4.0)
		msg("Botiquín: +25 vida")

func cast_skill_at(p: Vector3) -> void:
	var skill := skill_mode
	skill_mode = ""
	if skill == "misil":
		skill_cd["misil"] = TDData.SKILL_CD["misil"]
		for i in range(6):
			var a := rng.randf() * TAU
			var d := rng.randf() * 2.4
			strikes.append({"t": float(i) * 0.16, "aim": Vector3(p.x + cos(a) * d, 0, p.z + sin(a) * d), "dmg": 140.0, "splash": 2.6})
		msg("Descarga de rayos")
	elif skill == "radar":
		skill_cd["radar"] = TDData.SKILL_CD["radar"]
		TDFx.ring(world, Vector3(p.x, 0.12, p.z), 7.5, Color(0.3, 0.85, 1.0), 0.8)
		for e in enemies:
			if e["dead"]:
				continue
			var ep: Vector3 = e["pos"]
			if Vector2(ep.x - p.x, ep.z - p.z).length() <= 7.5:
				e["slow"] = 8.0
		msg("Radar: enemigos ralentizados (8s)")

func update_skills(dt: float) -> void:
	for k in skill_cd.keys():
		skill_cd[k] = maxf(0.0, float(skill_cd[k]) - dt)
	if base_shield > 0.0:
		base_shield -= dt
		if base_shield <= 0.0 and shield_node and is_instance_valid(shield_node):
			shield_node.queue_free()
			shield_node = null

func flash_screen(c: Color, duration: float) -> void:
	flash_rect.color = c
	var tw := flash_rect.create_tween()
	tw.tween_property(flash_rect, "color:a", 0.0, duration)

# ====================== Bucle principal ======================
func _input(event: InputEvent) -> void:
	if drag_key == "":
		return
	if event is InputEventMouseMotion:
		var mp: Vector2 = event.position
		if not drag_active and mp.distance_to(drag_start) > 8.0:
			start_drag_visual()
		if drag_active and drag_preview:
			drag_preview.position = mp + Vector2(18, 14)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		if drag_active:
			var pos: Vector2 = event.position
			if in_game and not over_hud(pos):
				var cell := pick_cell(pos)
				if cell.x >= 0:
					place_tower(drag_key, cell)
			build_type = ""
			drag_release_frame = Engine.get_process_frames()
			end_drag_visual()
		drag_key = ""
		drag_active = false

func on_tower_gui(event: InputEvent, key: String) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if in_game and not over and not paused:
			drag_key = key
			drag_start = get_viewport().get_mouse_position()
			drag_active = false

func over_hud(pos: Vector2) -> bool:
	if top_panel.get_global_rect().has_point(pos):
		return true
	if bottom_panel.get_global_rect().has_point(pos):
		return true
	if info_box.visible and info_box.get_global_rect().has_point(pos):
		return true
	return false

func start_drag_visual() -> void:
	drag_active = true
	build_type = drag_key
	selected = null
	info_box.visible = false
	sel_ring.visible = false
	drag_preview = panel()
	drag_preview.mouse_filter = Control.MOUSE_FILTER_IGNORE
	drag_preview.add_child(mk_label(TDData.TOWERS[drag_key]["name"], 15, COL_ACCENT))
	ui.add_child(drag_preview)

func end_drag_visual() -> void:
	if drag_preview and is_instance_valid(drag_preview):
		drag_preview.queue_free()
	drag_preview = null

func _unhandled_input(event: InputEvent) -> void:
	if not in_game:
		return
	if event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if (mm.button_mask & MOUSE_BUTTON_MASK_MIDDLE) != 0:
			var k := cam_dist / 46.0 * 0.06
			cam_target.x -= mm.relative.x * k
			cam_target.z -= mm.relative.y * k
	elif event is InputEventMouseButton and event.pressed:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(22.0, cam_dist - 2.5)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = minf(70.0, cam_dist + 2.5)
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			cancel_modes()
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			on_world_click(mb.position)
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			if build_type != "" or skill_mode != "" or selected != null:
				cancel_modes()
			else:
				toggle_pause()
		elif event.keycode == KEY_P:
			toggle_pause()
		elif event.keycode == KEY_SPACE:
			on_start_wave()
		elif event.keycode >= KEY_1 and event.keycode <= KEY_5 and not paused:
			on_build(TDData.TOWER_ORDER[int(event.keycode - KEY_1)])

func on_quality() -> void:
	quality = (quality + 1) % 3
	apply_quality()

func apply_quality() -> void:
	var names := ["Baja", "Media", "Alta"]
	btn_quality.text = "Gráficos: " + names[quality]
	sun.shadow_enabled = quality >= 1
	var env: Environment = env_node.environment
	if env:
		env.ssao_enabled = quality == 2
		env.glow_enabled = quality >= 1
	match quality:
		0:
			get_viewport().msaa_3d = Viewport.MSAA_DISABLED
		1:
			get_viewport().msaa_3d = Viewport.MSAA_2X
		_:
			get_viewport().msaa_3d = Viewport.MSAA_4X

func cancel_modes() -> void:
	build_type = ""
	skill_mode = ""
	selected = null
	info_box.visible = false
	sel_ring.visible = false
	msg("")

func on_world_click(mp: Vector2) -> void:
	if over or paused:
		return
	if skill_mode != "":
		var p: Variant = pick_point(mp)
		if p != null:
			var pv: Vector3 = p
			cast_skill_at(pv)
		return
	var cell := pick_cell(mp)
	if cell.x < 0:
		return
	if build_type != "":
		place_tower(build_type, cell)
		return
	select_at(cell)

func layout_ui() -> void:
	var vp := get_viewport().get_visible_rect().size
	lbl_msg.position = Vector2((vp.x - 600.0) / 2.0, 72.0)
	info_box.position = Vector2(vp.x - 300.0, 72.0)

func _process(delta: float) -> void:
	update_wind(delta)
	# Camara: desplazamiento por bordes de pantalla, zoom con rueda y arrastre con boton central
	var vp_size := get_viewport().get_visible_rect().size
	var mp0 := get_viewport().get_mouse_position()
	var pan := Vector2.ZERO
	if in_game and Rect2(Vector2.ZERO, vp_size).has_point(mp0):
		if mp0.x < 8.0:
			pan.x -= 1.0
		elif mp0.x > vp_size.x - 8.0:
			pan.x += 1.0
		if mp0.y < 8.0:
			pan.y -= 1.0
		elif mp0.y > vp_size.y - 8.0:
			pan.y += 1.0
	if in_game:
		cam_target += Vector3(pan.x, 0, pan.y) * 22.0 * delta * (cam_dist / 46.0)
		cam_target.x = clampf(cam_target.x, -12.0, W * TDData.TILE + 12.0)
		cam_target.z = clampf(cam_target.z, -12.0, H * TDData.TILE + 12.0)
	else:
		cam_orbit += delta * 0.08
		cam_target = Vector3(W * TDData.TILE * 0.5, 0, H * TDData.TILE * 0.5)
		cam_dist = 40.0
	var pitch := deg_to_rad(54.0)
	var yaw := cam_orbit if not in_game else 0.0
	var off := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * cam_dist
	cam.position = cam_target + off
	cam.look_at(cam_target, Vector3.UP)

	fps_t -= delta
	if fps_t <= 0.0:
		fps_t = 0.5
		lbl_fps.text = "%d FPS" % Engine.get_frames_per_second()

	if msg_t > 0.0:
		msg_t -= delta
		lbl_msg.modulate.a = clampf(msg_t / 0.6, 0.0, 1.0)

	if not in_game:
		return

	# Vista previa de construccion y habilidades
	var mp := get_viewport().get_mouse_position()
	if build_type != "":
		var cell := pick_cell(mp)
		if cell.x >= 0:
			var ok := can_build(cell.x, cell.y) and gold >= int(TDData.TOWERS[build_type]["cost"])
			ghost_mat.albedo_color = Color(0.3, 1.0, 0.5, 0.28) if ok else Color(1.0, 0.3, 0.25, 0.28)
			var st_range: float = TDData.TOWERS[build_type]["range"]
			var cp := cell_pos(cell.x, cell.y)
			ghost_ring.visible = true
			ghost_ring.position = Vector3(cp.x, 0.1, cp.z)
			ghost_ring.scale = Vector3(st_range, 1, st_range)
		else:
			ghost_ring.visible = false
	else:
		ghost_ring.visible = false

	if paused or over:
		update_hud()
		return

	var dt := delta * speed
	update_skills(dt)
	if wave_active:
		wave_time += dt
		while not wave_events.is_empty() and float(wave_events[0]["t"]) <= wave_time:
			var ev: Dictionary = wave_events.pop_front()
			spawn_enemy(ev["type"], ev["boss"])
		if wave_events.is_empty() and enemies.is_empty() and not over:
			end_wave()
	update_enemies(dt)
	update_towers(dt)
	update_projectiles(dt)
	update_strikes(dt)
	update_dying(dt)
	enemies = enemies.filter(func(x): return not x["dead"])
	update_bars()
	if shield_node and is_instance_valid(shield_node):
		shield_node.rotation.y += dt * 0.6
	update_towers_info()
	update_hud()

func update_hud() -> void:
	lbl_gold.text = "Oro: $%d" % gold
	lbl_lives.text = "Vidas: %d" % lives
	lbl_wave.text = "Oleada: %d / %d" % [wave, TDData.MAX_WAVE]
	lbl_kills.text = "Bajas: %d" % kills
	if wave_active:
		btn_wave.text = "Oleada en curso"
		btn_wave.disabled = true
	elif wave >= TDData.MAX_WAVE:
		btn_wave.text = "Completado"
		btn_wave.disabled = true
	else:
		btn_wave.text = "▶ Oleada %d" % (wave + 1)
		btn_wave.disabled = over
	for key in TDData.TOWER_ORDER:
		var b: Button = tower_btns[key]
		var cost: int = TDData.TOWERS[key]["cost"]
		b.disabled = gold < cost and build_type != key
		b.modulate = Color(1.0, 0.9, 0.5) if build_type == key else Color(1, 1, 1)
	var names := {"misil": "Rayo", "radar": "Radar", "nuke": "Bomba", "shield": "Escudo", "heal": "Botiquín"}
	var cd_key := {"misil": "misil", "radar": "radar", "nuke": "nuke", "shield": "shield", "heal": "heal"}
	for k in names.keys():
		var b2: Button = skill_btns[k]
		var cd: float = skill_cd[cd_key[k]]
		b2.text = "%s\n%s" % [names[k], ("%ds" % int(ceil(cd))) if cd > 0.0 else "LISTO"]
		b2.disabled = cd > 0.0
		b2.modulate = Color(1, 0.9, 0.5) if skill_mode == k else Color(1, 1, 1)
