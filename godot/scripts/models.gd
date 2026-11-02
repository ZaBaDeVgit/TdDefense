# Modelos 3D procedurales (primitivas de Godot). Todos miran hacia -Z.
class_name TDModels
extends RefCounted

static var _mats: Dictionary = {}

# Modelos glTF (CC0, ver assets/models/CREDITOS_MODELOS.txt): nombre, tamano objetivo
const GLB_ENEMIES := {
	"soldier": ["soldier", 1.8], "shield": ["soldier", 1.8], "spider": ["robot_walker", 1.6],
	"jeep": ["suv", 2.2], "tank": ["tank", 3.0], "truck": ["truck_flat", 3.0], "drone": ["robot_flyer", 1.2],
}
const GLB_PROPS := {
	"pine": ["tree_pine", 2.8], "palm": ["tree_palm", 2.6], "broadleaf": ["tree_oak", 2.4],
	"rock": ["rock_large", 1.1], "snowrock": ["rock_large", 1.3], "cactus": ["cactus", 1.6],
	"skyscraper": ["skyscraper_a", 4.5], "car": ["sedan", 1.5], "barracks": ["tent", 1.6],
}
# Giro extra si los modelos miran hacia otro lado (en radianes). Ajustar si se ven de espaldas.
const GLB_YAW := 0.0

# Carga un modelo .glb de assets/models y lo escala para que su lado mayor mida 'target'.
# Devuelve null si no existe (entonces se usa el modelo procedural).
static func load_model(model_name: String, target: float) -> Node3D:
	var path := "res://assets/models/" + model_name + ".glb"
	if not ResourceLoader.exists(path):
		push_warning("Modelo no encontrado (se usa el procedural): " + path)
		return null
	var ps := load(path) as PackedScene
	if ps == null:
		return null
	var inst := ps.instantiate() as Node3D
	if inst == null:
		return null
	var boxes: Array = []
	_collect_aabb(inst, Transform3D.IDENTITY, boxes)
	if boxes.is_empty():
		inst.queue_free()
		return null
	var bb: AABB = boxes[0]
	for b in boxes:
		bb = bb.merge(b)
	var ext := maxf(bb.size.x, maxf(bb.size.y, bb.size.z))
	if ext < 0.0001 or ext > 1000.0:
		inst.queue_free()
		return null
	var c := Vector3(bb.position.x + bb.size.x / 2.0, bb.position.y, bb.position.z + bb.size.z / 2.0)
	inst.position = -c
	var holder := Node3D.new()
	holder.add_child(inst)
	holder.scale = Vector3.ONE * (target / ext)
	holder.rotation.y = GLB_YAW
	return holder

static func _collect_aabb(node: Node, xf: Transform3D, acc: Array) -> void:
	for child in node.get_children():
		if child is Node3D:
			var cxf: Transform3D = xf * (child as Node3D).transform
			if child is MeshInstance3D and (child as MeshInstance3D).mesh != null:
				acc.append(cxf * (child as MeshInstance3D).mesh.get_aabb())
			_collect_aabb(child, cxf, acc)

static func mat(key: String) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.roughness = 0.7
	var col := Color.WHITE
	match key:
		"olive": col = Color("#5b6b3a")
		"camo": col = Color("#4e5a33")
		"tan": col = Color("#b49a6a")
		"steel":
			col = Color("#8a9199"); m.metallic = 0.8; m.roughness = 0.3
		"dark":
			col = Color("#2a2e35"); m.metallic = 0.5; m.roughness = 0.5
		"rubber": col = Color("#1d1d1f"); m.roughness = 0.95
		"concrete": col = Color("#9a9a94")
		"white": col = Color("#e8ecef")
		"red": col = Color("#b83a30")
		"wood": col = Color("#6b4a2b")
		"leaf": col = Color("#2f6b2a")
		"leaf2": col = Color("#3d7d34")
		"cactus": col = Color("#4f7a3a")
		"rock": col = Color("#7a736a")
		"sand": col = Color("#d7b67e")
		"snow": col = Color("#eef3f7")
		"skin": col = Color("#d8b08c")
		"building": col = Color("#3a4256"); m.metallic = 0.3
		"glass": col = Color("#2c4a66"); m.metallic = 0.6; m.roughness = 0.15
		"carred": col = Color("#9c2a24"); m.metallic = 0.4
		"carblue": col = Color("#2b4f8a"); m.metallic = 0.4
		"orange", "cyan", "green", "yellow", "lampglow":
			col = {"orange": Color("#ff8a1a"), "cyan": Color("#44c8ff"), "green": Color("#7dff7a"),
				"yellow": Color("#ffd166"), "lampglow": Color("#fff2b0")}[key]
			m.emission_enabled = true
			m.emission = col
			m.emission_energy_multiplier = 2.0
		"glass_clear":
			col = Color(0.6, 0.85, 1.0, 0.35)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_:
			if key.begins_with("#"):
				col = Color(key)
	m.albedo_color = col
	if key == "camo" or key == "olive":
		m.albedo_texture = camo_noise()
		m.uv1_scale = Vector3(2, 2, 1)
	_mats[key] = m
	return m

# Texturas procedurales (ruido de Godot), creadas una sola vez
static var _soft_noise: NoiseTexture2D = null
static var _camo_noise: NoiseTexture2D = null

static func soft_noise() -> Texture2D:
	if _soft_noise == null:
		var fn := FastNoiseLite.new()
		fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		fn.frequency = 0.05
		fn.fractal_octaves = 3
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 1.0])
		g.colors = PackedColorArray([Color(0.8, 0.8, 0.8), Color(1, 1, 1)])
		_soft_noise = NoiseTexture2D.new()
		_soft_noise.noise = fn
		_soft_noise.color_ramp = g
		_soft_noise.width = 256
		_soft_noise.height = 256
		_soft_noise.seamless = true
	return _soft_noise

static func camo_noise() -> Texture2D:
	if _camo_noise == null:
		var fn := FastNoiseLite.new()
		fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		fn.frequency = 0.035
		fn.fractal_octaves = 4
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
		g.colors = PackedColorArray([Color(0.5, 0.5, 0.5), Color(0.85, 0.85, 0.85), Color(1, 1, 1)])
		_camo_noise = NoiseTexture2D.new()
		_camo_noise.noise = fn
		_camo_noise.color_ramp = g
		_camo_noise.width = 256
		_camo_noise.height = 256
		_camo_noise.seamless = true
	return _camo_noise

static func ground_mat(col: Color) -> StandardMaterial3D:
	var key := "gnd:" + col.to_html(false)
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.albedo_texture = soft_noise()
	m.uv1_scale = Vector3(3, 3, 1)
	m.roughness = 0.95
	_mats[key] = m
	return m

static func glow(hex: String, energy: float = 2.0) -> StandardMaterial3D:
	var key := "glow:" + hex + ":" + str(energy)
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(hex)
	m.emission_enabled = true
	m.emission = Color(hex)
	m.emission_energy_multiplier = energy
	_mats[key] = m
	return m

static func box(parent: Node3D, size: Vector3, m: Material, pos: Vector3 = Vector3.ZERO, rot: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi

static func cyl(parent: Node3D, r_top: float, r_bot: float, h: float, m: Material, pos: Vector3 = Vector3.ZERO, rot: Vector3 = Vector3.ZERO, seg: int = 14) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r_top
	cm.bottom_radius = r_bot
	cm.height = h
	cm.radial_segments = seg
	mi.mesh = cm
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi

static func sph(parent: Node3D, r: float, m: Material, pos: Vector3 = Vector3.ZERO, sc: Vector3 = Vector3.ONE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = r
	sm.height = r * 2.0
	sm.radial_segments = 16
	sm.rings = 8
	mi.mesh = sm
	mi.material_override = m
	mi.position = pos
	mi.scale = sc
	parent.add_child(mi)
	return mi

static func torus(parent: Node3D, inner: float, outer: float, m: Material, pos: Vector3 = Vector3.ZERO, rot: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = inner
	tm.outer_radius = outer
	mi.mesh = tm
	mi.material_override = m
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi

static func pivot(parent: Node3D, pos: Vector3 = Vector3.ZERO, rot: Vector3 = Vector3.ZERO) -> Node3D:
	var n := Node3D.new()
	n.position = pos
	n.rotation = rot
	parent.add_child(n)
	return n

# ---------------- Torres ----------------
static func build_tower(type: String, level: int) -> Node3D:
	var root := Node3D.new()
	box(root, Vector3(2.4, 0.45, 2.4), mat("dark"), Vector3(0, 0.22, 0))
	cyl(root, 1.3, 1.45, 0.45, mat("dark"), Vector3(0, 0.22, 0), Vector3.ZERO, 8)
	torus(root, 1.18, 1.28, glow("#ff8a1a", 1.5), Vector3(0, 0.47, 0), Vector3(PI / 2, 0, 0))
	for i in range(level):
		var a := -PI / 2 + float(i) * (PI * 2.0 / 3.0)
		sph(root, 0.1, glow("#ffd166", 3.0), Vector3(cos(a) * 1.0, 0.55, sin(a) * 1.0))
	var turret := pivot(root, Vector3(0, 0.6, 0))
	root.set_meta("turret", turret)
	match type:
		"mg":
			box(turret, Vector3(0.9, 0.5, 0.9), mat("olive"), Vector3(0, 0.25, 0))
			box(turret, Vector3(0.5, 0.35, 0.5), mat("camo"), Vector3(0, 0.6, 0.1))
			for sx in [-0.25, 0.25]:
				cyl(turret, 0.07, 0.07, 1.7, mat("steel"), Vector3(sx, 0.6, -0.85), Vector3(PI / 2, 0, 0))
			box(turret, Vector3(0.4, 0.4, 0.4), mat("rubber"), Vector3(0.6, 0.3, 0.2))
		"missile":
			box(turret, Vector3(1.3, 0.5, 1.3), mat("olive"), Vector3(0, 0.25, 0))
			for sx in [-0.3, 0.3]:
				for sy in [0.55, 0.9]:
					cyl(turret, 0.2, 0.2, 1.3, mat("camo"), Vector3(sx, sy, -0.4), Vector3(PI / 2, 0, 0), 12)
					sph(turret, 0.2, glow("#ff6b4a", 1.0), Vector3(sx, sy, -1.05), Vector3(1, 1, 0.6))
		"laser":
			sph(turret, 0.62, mat("dark"), Vector3(0, 0.45, 0), Vector3(1, 0.8, 1))
			cyl(turret, 0.12, 0.12, 1.8, glow("#44c8ff", 2.5), Vector3(0, 0.5, -1.0), Vector3(PI / 2, 0, 0), 10)
			sph(turret, 0.25, glow("#44c8ff", 3.5), Vector3(0, 0.55, -0.2))
		"aa":
			box(turret, Vector3(1.1, 0.5, 1.1), mat("tan"), Vector3(0, 0.25, 0))
			for sx in [-0.3, 0.3]:
				cyl(turret, 0.1, 0.1, 2.0, mat("steel"), Vector3(sx, 0.7, -0.9), Vector3(PI / 2, 0, 0), 10)
		"tesla":
			cyl(root, 0.18, 0.25, 2.2, mat("steel"), Vector3(0, 1.6, 0))
			turret.position = Vector3(0, 2.8, 0)
			sph(turret, 0.45, glow("#7fe9ff", 3.0), Vector3(0, 0, 0))
			torus(turret, 0.5, 0.6, glow("#7fe9ff", 1.5), Vector3(0, 0, 0), Vector3(PI / 2, 0, 0))
	# Detalles comunes: pernos, cables y luz de estado
	for i in range(6):
		var ang := float(i) * TAU / 6.0
		sph(root, 0.05, mat("steel"), Vector3(cos(ang) * 1.22, 0.5, sin(ang) * 1.22))
	cyl(root, 0.03, 0.03, 0.9, mat("rubber"), Vector3(1.05, 0.7, 0.5))
	sph(root, 0.07, glow("#7dff7a", 3.0), Vector3(-0.9, 0.55, 0.9))
	return root

# ---------------- Enemigos ----------------
static func build_enemy(type: String) -> Node3D:
	var root := Node3D.new()
	var body := pivot(root)
	root.set_meta("body", body)
	if GLB_ENEMIES.has(type):
		var spec: Array = GLB_ENEMIES[type]
		var m := load_model(String(spec[0]), float(spec[1]))
		if m != null:
			body.add_child(m)
			if type == "shield":
				box(body, Vector3(0.7, 1.0, 0.1), mat("steel"), Vector3(0, 1.0, -0.35))
			root.set_meta("legs", [])
			root.set_meta("rotors", [])
			return root
	var legs: Array = []
	var rotors: Array = []
	match type:
		"soldier", "shield":
			for sx in [-0.15, 0.15]:
				legs.append(pivot(body, Vector3(sx, 0.7, 0)))
				box(legs[-1], Vector3(0.22, 0.7, 0.25), mat("olive"), Vector3(0, -0.35, 0))
			box(body, Vector3(0.5, 0.6, 0.3), mat("camo"), Vector3(0, 1.05, 0))
			sph(body, 0.22, mat("skin"), Vector3(0, 1.6, 0))
			sph(body, 0.25, mat("camo"), Vector3(0, 1.68, 0), Vector3(1, 0.6, 1))
			box(body, Vector3(0.12, 0.12, 0.7), mat("dark"), Vector3(0.3, 1.1, -0.35))
			if type == "shield":
				box(body, Vector3(0.7, 1.0, 0.1), mat("steel"), Vector3(0, 1.0, -0.35))
		"spider":
			sph(body, 0.5, mat("steel"), Vector3(0, 0.7, 0), Vector3(1, 0.7, 1.2))
			sph(body, 0.25, mat("dark"), Vector3(0, 0.8, -0.55))
			sph(body, 0.07, glow("#ff3b30", 3.0), Vector3(-0.1, 0.85, -0.78))
			sph(body, 0.07, glow("#ff3b30", 3.0), Vector3(0.1, 0.85, -0.78))
			for i in range(8):
				var side := -1.0 if i < 4 else 1.0
				var k := i % 4
				var ang := (k - 1.5) * 0.45
				var leg := pivot(body, Vector3(side * 0.35, 0.7, -0.2 + k * 0.18), Vector3(0, -side * 0.0, 0))
				legs.append(leg)
				cyl(leg, 0.04, 0.04, 1.3, mat("dark"), Vector3(side * 0.6, -0.35, 0), Vector3(0, 0, side * 0.9 + ang * 0.3))
		"jeep":
			box(body, Vector3(1.6, 0.5, 2.0), mat("olive"), Vector3(0, 0.55, 0))
			box(body, Vector3(1.3, 0.5, 1.0), mat("camo"), Vector3(0, 1.0, 0.2))
			cyl(body, 0.07, 0.07, 1.2, mat("steel"), Vector3(0, 1.1, -0.8), Vector3(PI / 2, 0, 0))
			for p in [Vector3(-0.85, 0.3, -0.7), Vector3(0.85, 0.3, -0.7), Vector3(-0.85, 0.3, 0.7), Vector3(0.85, 0.3, 0.7)]:
				cyl(body, 0.32, 0.32, 0.25, mat("rubber"), p, Vector3(0, 0, PI / 2), 14)
		"tank":
			box(body, Vector3(2.2, 0.6, 3.0), mat("camo"), Vector3(0, 0.6, 0))
			for sx in [-1.2, 1.2]:
				box(body, Vector3(0.45, 0.7, 3.1), mat("dark"), Vector3(sx, 0.4, 0))
			cyl(body, 0.8, 0.9, 0.5, mat("camo"), Vector3(0, 1.1, 0.1))
			cyl(body, 0.12, 0.12, 2.0, mat("steel"), Vector3(0, 1.2, -1.2), Vector3(PI / 2, 0, 0))
		"truck":
			box(body, Vector3(2.0, 1.3, 2.6), mat("olive"), Vector3(0, 1.0, 0.3))
			box(body, Vector3(1.9, 0.9, 1.0), mat("camo"), Vector3(0, 1.1, -1.3))
			box(body, Vector3(1.8, 0.15, 0.4), glow("#ffd166", 1.0), Vector3(0, 1.2, -1.85))
			for z in [-1.0, 0.2, 1.4]:
				for sx in [-1.0, 1.0]:
					cyl(body, 0.36, 0.36, 0.3, mat("rubber"), Vector3(sx, 0.36, z), Vector3(0, 0, PI / 2), 14)
		"drone":
			sph(body, 0.35, mat("dark"), Vector3(0, 3.6 - 3.6, 0), Vector3(1, 0.6, 1))
			sph(body, 0.12, glow("#ff3b30", 3.0), Vector3(0, -0.05, -0.3))
			for p in [Vector3(-0.5, 0, -0.5), Vector3(0.5, 0, -0.5), Vector3(-0.5, 0, 0.5), Vector3(0.5, 0, 0.5)]:
				box(body, Vector3(0.08, 0.05, 0.08), mat("steel"), p * 0.6)
				var rt := pivot(body, p)
				rotors.append(rt)
				cyl(rt, 0.4, 0.4, 0.03, glow("#ffffff", 0.2), Vector3(0, 0.1, 0), Vector3.ZERO, 12)
		"heli":
			sph(body, 0.8, mat("olive"), Vector3(0, 0.3, 0), Vector3(1, 0.9, 1.8))
			box(body, Vector3(0.2, 0.2, 2.2), mat("olive"), Vector3(0, 0.5, 2.0))
			box(body, Vector3(0.1, 0.5, 0.4), mat("olive"), Vector3(0.0, 0.8, 3.0))
			box(body, Vector3(1.8, 0.08, 0.08), mat("dark"), Vector3(-0.6, -0.4, 0.1))
			box(body, Vector3(1.8, 0.08, 0.08), mat("dark"), Vector3(0.6, -0.4, 0.1))
			box(body, Vector3(0.1, 0.4, 0.1), mat("dark"), Vector3(-0.6, -0.15, 0.1))
			box(body, Vector3(0.1, 0.4, 0.1), mat("dark"), Vector3(0.6, -0.15, 0.1))
			var rotor := pivot(body, Vector3(0, 1.0, 0))
			rotors.append(rotor)
			box(rotor, Vector3(6.0, 0.04, 0.3), mat("dark"), Vector3.ZERO)
			box(rotor, Vector3(0.3, 0.04, 6.0), mat("dark"), Vector3.ZERO)
	match type:
		"soldier", "shield":
			box(body, Vector3(0.42, 0.55, 0.18), mat("dark"), Vector3(0, 1.05, 0.25))
			box(body, Vector3(0.3, 0.08, 0.3), mat("rubber"), Vector3(0, 0.02, 0.0))
		"jeep":
			box(body, Vector3(1.3, 0.42, 0.04), mat("glass_clear"), Vector3(0, 1.05, -0.32), Vector3(-0.3, 0, 0))
			sph(body, 0.1, glow("#ffe9b0", 3.0), Vector3(-0.5, 0.6, -1.02))
			sph(body, 0.1, glow("#ffe9b0", 3.0), Vector3(0.5, 0.6, -1.02))
		"tank":
			for z in [-1.2, -0.6, 0.0, 0.6, 1.2]:
				for sx in [-1.25, 1.25]:
					cyl(body, 0.16, 0.16, 0.12, mat("rubber"), Vector3(sx, 0.25, z), Vector3(0, 0, PI / 2))
			sph(body, 0.22, mat("steel"), Vector3(0.3, 1.4, 0.4))
		"truck":
			box(body, Vector3(1.7, 0.5, 0.05), mat("glass_clear"), Vector3(0, 1.4, -1.82))
		"heli":
			sph(body, 0.6, mat("glass_clear"), Vector3(0, 0.35, -1.0), Vector3(1, 0.9, 0.8))
	root.set_meta("legs", legs)
	root.set_meta("rotors", rotors)
	return root

# ---------------- Decoracion ----------------
static func build_prop(kind: String, rng: RandomNumberGenerator) -> Node3D:
	var root := Node3D.new()
	var s := rng.randf_range(0.8, 1.25)
	if GLB_PROPS.has(kind):
		var spec: Array = GLB_PROPS[kind]
		var target: float = float(spec[1])
		if kind == "skyscraper":
			target = rng.randf_range(3.5, 6.0)
		var m := load_model(String(spec[0]), target)
		if m != null:
			m.scale = m.scale * s
			m.rotation.y = rng.randf() * TAU
			return m
	match kind:
		"pine":
			cyl(root, 0.12, 0.14, 0.9, mat("wood"), Vector3(0, 0.45, 0))
			cyl(root, 0.0, 0.7, 1.6, mat("leaf"), Vector3(0, 1.5, 0), Vector3.ZERO, 8)
			cyl(root, 0.0, 0.5, 1.1, mat("leaf2"), Vector3(0, 2.1, 0), Vector3.ZERO, 8)
		"broadleaf":
			cyl(root, 0.1, 0.14, 1.1, mat("wood"), Vector3(0, 0.55, 0))
			sph(root, 0.8, mat("leaf2"), Vector3(0, 1.7, 0), Vector3(1, 0.85, 1))
			sph(root, 0.55, mat("leaf"), Vector3(0.3, 2.2, 0.1))
		"rock":
			sph(root, 0.6, mat("rock"), Vector3(0, 0.25, 0), Vector3(1.2, 0.7, 1.0))
		"snowrock":
			sph(root, 0.7, mat("rock"), Vector3(0, 0.3, 0), Vector3(1.2, 0.9, 1.0))
			sph(root, 0.45, mat("snow"), Vector3(0, 0.9, 0), Vector3(1.2, 0.5, 1.0))
		"watch":
			cyl(root, 0.4, 0.5, 2.8, mat("concrete"), Vector3(0, 1.4, 0))
			box(root, Vector3(1.4, 0.7, 1.4), mat("olive"), Vector3(0, 3.0, 0))
			box(root, Vector3(1.5, 0.12, 1.5), mat("dark"), Vector3(0, 3.4, 0))
		"barracks":
			box(root, Vector3(1.8, 0.9, 2.4), mat("tan"), Vector3(0, 0.45, 0))
			box(root, Vector3(2.0, 0.15, 2.6), mat("camo"), Vector3(0, 1.0, 0), Vector3(0.12, 0, 0))
		"cactus":
			cyl(root, 0.18, 0.2, 1.4, mat("cactus"), Vector3(0, 0.7, 0), Vector3.ZERO, 10)
			cyl(root, 0.12, 0.12, 0.6, mat("cactus"), Vector3(0.3, 0.9, 0), Vector3(0, 0, -PI / 2.5), 10)
		"dune":
			sph(root, 1.3, mat("sand"), Vector3(0, -0.2, 0), Vector3(1.4, 0.3, 1.0))
		"palm":
			cyl(root, 0.08, 0.12, 2.2, mat("wood"), Vector3(0, 1.1, 0), Vector3(0.1, 0, 0.1), 8)
			for i in range(5):
				var a := float(i) * TAU / 5.0
				box(root, Vector3(0.2, 0.05, 1.3), mat("leaf"), Vector3(sin(a) * 0.6, 2.3, cos(a) * 0.6), Vector3(0.35, a, 0))
		"skyscraper":
			var h := rng.randf_range(3.0, 6.5)
			box(root, Vector3(1.4, h, 1.4), mat("building"), Vector3(0, h / 2.0, 0))
			box(root, Vector3(1.0, 0.2, 1.0), glow("#44c8ff", 0.6), Vector3(0, h + 0.1, 0))
		"lamp":
			cyl(root, 0.05, 0.07, 2.4, mat("dark"), Vector3(0, 1.2, 0), Vector3.ZERO, 6)
			sph(root, 0.2, mat("lampglow"), Vector3(0, 2.5, 0))
		"car":
			var col := "#9c2a24" if rng.randf() < 0.5 else "#2b4f8a"
			box(root, Vector3(0.9, 0.45, 1.6), mat(col), Vector3(0, 0.35, 0))
			box(root, Vector3(0.75, 0.4, 0.8), mat("glass"), Vector3(0, 0.75, -0.1))
			root.rotation.y = rng.randf() * TAU
	root.scale = Vector3(s, s, s)
	return root

# ---------------- Base y marcadores ----------------
static func build_hq() -> Node3D:
	var root := Node3D.new()
	cyl(root, 2.3, 2.4, 0.4, mat("concrete"), Vector3(0, 0.2, 0), Vector3.ZERO, 8)
	box(root, Vector3(2.4, 1.6, 2.4), mat("olive"), Vector3(0, 1.2, 0))
	box(root, Vector3(2.6, 0.2, 2.6), mat("dark"), Vector3(0, 2.1, 0))
	var core := cyl(root, 0.9, 0.9, 0.25, glow("#ff8a1a", 2.2), Vector3(0, 2.3, 0), Vector3.ZERO, 16)
	root.set_meta("core", core)
	torus(root, 2.6, 2.75, glow("#44c8ff", 1.5), Vector3(0, 0.45, 0), Vector3(PI / 2, 0, 0))
	cyl(root, 0.05, 0.05, 2.2, mat("steel"), Vector3(1.4, 3.2, 1.4))
	sph(root, 0.45, mat("white"), Vector3(1.4, 4.4, 1.4), Vector3(1, 0.4, 1))
	return root

static func build_spawn() -> Node3D:
	var root := Node3D.new()
	cyl(root, 1.2, 1.3, 0.2, mat("concrete"), Vector3(0, 0.1, 0), Vector3.ZERO, 8)
	torus(root, 0.9, 1.05, glow("#7dff7a", 2.0), Vector3(0, 0.25, 0), Vector3(PI / 2, 0, 0))
	return root

static func build_missile() -> Node3D:
	var root := Node3D.new()
	cyl(root, 0.1, 0.1, 0.7, mat("white"), Vector3(0, 0, 0), Vector3(PI / 2, 0, 0), 8)
	sph(root, 0.12, glow("#ff8a1a", 3.0), Vector3(0, 0, -0.36))
	return root
