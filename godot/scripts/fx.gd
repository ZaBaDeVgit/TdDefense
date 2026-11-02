# Efectos visuales: explosiones, humo, chispas, destellos, rayos y textos flotantes.
class_name TDFx
extends RefCounted

static var _soft: GradientTexture2D = null

static func soft_tex() -> Texture2D:
	if _soft == null:
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
		g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.45), Color(1, 1, 1, 0)])
		_soft = GradientTexture2D.new()
		_soft.gradient = g
		_soft.fill = GradientTexture2D.FILL_RADIAL
		_soft.fill_from = Vector2(0.5, 0.5)
		_soft.fill_to = Vector2(1.0, 0.5)
		_soft.width = 128
		_soft.height = 128
	return _soft

static func particle_mat(additive: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = soft_tex()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if additive else BaseMaterial3D.BLEND_MODE_MIX
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	return m

# Rafaga de particulas (one-shot). Se libera sola al terminar.
static func burst(world: Node3D, pos: Vector3, color: Color, count: int, speed: float, size: float, life: float, additive: bool = true, gravity: float = -3.0, spread: float = 180.0) -> void:
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = count
	p.lifetime = life
	p.local_coords = false
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = spread
	pm.initial_velocity_min = speed * 0.4
	pm.initial_velocity_max = speed
	pm.gravity = Vector3(0, gravity, 0)
	pm.damping_min = 1.0
	pm.damping_max = 2.5
	pm.scale_min = 0.5
	pm.scale_max = 1.25
	pm.color = color
	p.process_material = pm
	var qm := QuadMesh.new()
	qm.size = Vector2(size, size)
	qm.material = particle_mat(additive)
	p.draw_pass_1 = qm
	p.position = pos
	world.add_child(p)
	p.emitting = true
	p.finished.connect(p.queue_free)

static func smoke(world: Node3D, pos: Vector3, count: int = 18, color: Color = Color(0.35, 0.35, 0.37, 0.8), size: float = 1.2) -> void:
	burst(world, pos, color, count, 1.6, size, 1.8, false, 0.8, 35.0)

static func sparks(world: Node3D, pos: Vector3, count: int = 24, color: Color = Color(1.0, 0.7, 0.3), speed: float = 6.0) -> void:
	burst(world, pos, color, count, speed, 0.22, 0.6, true, -9.0, 180.0)

# Bola de fuego emisiva que crece y se desvanece
static func fireball(world: Node3D, pos: Vector3, radius: float, color: Color, life: float = 0.45) -> void:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 2.0
	sm.radial_segments = 16
	sm.rings = 8
	mi.mesh = sm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(color.r, color.g, color.b, 0.9)
	mi.material_override = m
	mi.position = pos
	mi.scale = Vector3.ONE * 0.2
	world.add_child(mi)
	var t := mi.create_tween()
	t.set_parallel(true)
	t.tween_property(mi, "scale", Vector3.ONE * radius, life).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_property(m, "albedo_color:a", 0.0, life)
	t.chain().tween_callback(mi.queue_free)

# Destello de disparo (sprite billboard que se expande)
static func flash(world: Node3D, pos: Vector3, color: Color, size: float = 0.9, life: float = 0.08) -> void:
	var mi := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(1, 1)
	mi.mesh = qm
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.albedo_texture = soft_tex()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.no_depth_test = true
	mi.material_override = m
	mi.position = pos
	mi.scale = Vector3.ONE * size
	world.add_child(mi)
	var t := mi.create_tween()
	t.tween_property(mi, "scale", Vector3.ONE * size * 1.6, life)
	t.chain().tween_callback(mi.queue_free)

# Onda expansiva en el suelo
static func ring(world: Node3D, pos: Vector3, radius: float, color: Color, life: float = 0.5) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.0
	cm.bottom_radius = 1.0
	cm.height = 0.04
	cm.radial_segments = 40
	mi.mesh = cm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(color.r, color.g, color.b, 0.9)
	mi.material_override = m
	mi.position = pos
	mi.scale = Vector3(0.2, 1, 0.2)
	world.add_child(mi)
	var t := mi.create_tween()
	t.set_parallel(true)
	t.tween_property(mi, "scale", Vector3(radius, 1, radius), life).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	t.tween_property(m, "albedo_color:a", 0.0, life)
	t.chain().tween_callback(mi.queue_free)

# Explosion completa: bola de fuego, onda, chispas, escombros y humo
static func explosion(world: Node3D, pos: Vector3, size: float = 1.0, color: Color = Color(1.0, 0.55, 0.12)) -> void:
	fireball(world, pos + Vector3(0, 0.3, 0), 1.2 * size, color)
	fireball(world, pos + Vector3(0, 0.1, 0), 0.7 * size, Color(1, 0.95, 0.7), 0.3)
	ring(world, pos + Vector3(0, 0.05, 0), 1.6 * size, color)
	sparks(world, pos + Vector3(0, 0.4, 0), int(20 + 16 * size), Color(1.0, 0.75, 0.35), 5.0 + size)
	burst(world, pos + Vector3(0, 0.3, 0), Color(0.12, 0.1, 0.09), int(10 + 6 * size), 4.0, 0.3, 0.9, false, -10.0, 90.0)
	smoke(world, pos + Vector3(0, 0.6, 0), int(10 + 8 * size), Color(0.3, 0.3, 0.32, 0.7), 0.9 * size)

# Rayo (haz) entre dos puntos que se desvanece
static func beam(world: Node3D, a: Vector3, b: Vector3, color: Color, width: float = 0.06, life: float = 0.12) -> void:
	var d := b - a
	var seg_len := d.length()
	if seg_len < 0.01:
		return
	var holder := Node3D.new()
	world.add_child(holder)
	holder.global_position = (a + b) * 0.5
	var up := Vector3.UP if absf(d.normalized().y) < 0.95 else Vector3.RIGHT
	holder.look_at(b, up)
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = width
	cm.bottom_radius = width
	cm.height = seg_len
	cm.radial_segments = 6
	mi.mesh = cm
	mi.rotation = Vector3(PI / 2, 0, 0)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = color
	mi.material_override = m
	holder.add_child(mi)
	var t := holder.create_tween()
	t.tween_property(m, "albedo_color:a", 0.0, life)
	t.tween_callback(holder.queue_free)

static func float_text(world: Node3D, pos: Vector3, text: String, color: Color, size: int = 40) -> void:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.012
	l.modulate = color
	l.outline_size = 10
	l.outline_modulate = Color(0, 0, 0, 0.9)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.position = pos
	world.add_child(l)
	var t := l.create_tween()
	t.set_parallel(true)
	t.tween_property(l, "position:y", pos.y + 1.6, 1.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_property(l, "modulate:a", 0.0, 1.0)
	t.chain().tween_callback(l.queue_free)
