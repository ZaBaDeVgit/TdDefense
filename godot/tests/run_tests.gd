# Ejecutar tras la importación: godot --headless --path godot --script res://tests/run_tests.gd
extends SceneTree

var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run_tests")

func check(condition: bool, description: String) -> void:
	checks += 1
	if not condition:
		failures.append(description)
		printerr("FALLO: " + description)

func run_tests() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	check(scene != null, "La escena principal se carga")
	if scene == null:
		quit(1)
		return
	var game = scene.instantiate()
	root.add_child(game)
	await process_frame
	check(not game.in_game and game.menu_root.visible, "El menú aparece al iniciar")
	var sky: Sky = game.env_node.environment.sky

	# Se comprueba que el proyecto utilice los GLB, no el respaldo procedural.
	for key in TDModels.GLB_TOWERS:
		var model := TDModels.build_tower(key, 1)
		check(model.has_meta("uses_original_model"), "Modelo original de torre: " + key)
		model.free()
	for key in TDModels.GLB_ENEMIES:
		var model := TDModels.build_enemy(key)
		check(model.has_meta("uses_original_model"), "Modelo original de enemigo: " + key)
		model.free()
	for wave_number in range(1, TDData.MAX_WAVE + 1):
		var events := TDData.build_wave(wave_number)
		var sorted := true
		var has_boss := false
		var last_time := -1.0
		for event in events:
			if float(event["t"]) < last_time or not TDData.ENEMIES.has(event["type"]):
				sorted = false
			last_time = float(event["t"])
			has_boss = has_boss or bool(event["boss"])
		check(sorted and not events.is_empty(), "Oleada %d: eventos ordenados y válidos" % wave_number)
		if wave_number in [5, 10, 15]:
			check(has_boss, "Oleada %d: aparece el jefe" % wave_number)

	for i in range(TDData.SCENARIOS.size()):
		game.rng.seed = 1234 + i
		game.on_play(i)
		await process_frame
		var label: String = TDData.SCENARIOS[i]["name"]
		check(game.env_node.environment.sky == sky, label + ": se reutiliza el cielo al cambiar de escenario")
		check(game.in_game and game.path_pts.size() > 1, label + ": ruta válida")
		check(game.enemy_pos_on_path(0.0).distance_to(game.spawn_pos) < 0.01, label + ": entrada")
		check(game.enemy_pos_on_path(game.path_total).distance_to(game.base_pos) < 0.01, label + ": destino")
		var monotonic := true
		var inside := true
		var gentle := true
		for j in range(1, game.path_len.size()):
			if game.path_len[j] <= game.path_len[j - 1]:
				monotonic = false
			var point: Vector3 = game.path_pts[j]
			var cell := Vector2i(floori(point.x / TDData.TILE), floori(point.z / TDData.TILE))
			if not game.passable(cell.x, cell.y):
				inside = false
			if j > 1:
				var a: Vector3 = game.path_pts[j - 2]
				var b: Vector3 = game.path_pts[j - 1]
				if (b - a).normalized().dot((point - b).normalized()) < 0.65:
					gentle = false
		check(monotonic, label + ": distancia de ruta creciente")
		check(inside, label + ": curva dentro de la carretera")
		check(gentle, label + ": giros suavizados")
		if i < 3:
			check(game.world.get_node_or_null("HierbaConViento") != null, label + ": vegetación con viento")
		else:
			check(game.world.get_node_or_null("HierbaConViento") == null, label + ": ciudad sin hierba")

	game.rng.seed = 4321
	game.on_play(0)
	await process_frame
	check(game.gold == TDData.START_GOLD and game.lives == TDData.START_LIVES, "Economía y vida iniciales")
	var viewport_rect := root.get_visible_rect()
	check(viewport_rect.encloses(game.bottom_panel.get_global_rect()), "La barra inferior cabe en la pantalla")
	check(viewport_rect.encloses(game.btn_wave.get_global_rect()), "El botón de oleada no queda recortado")
	check(game.sun.shadow_enabled, "Las sombras están activas en calidad alta")
	game.quality = 0
	game.apply_quality()
	check(not game.sun.shadow_enabled, "Calidad baja desactiva sombras")
	game.quality = 2
	game.apply_quality()
	if not game.wind_props.is_empty():
		var tree: Node3D = game.wind_props[0]["node"]
		var previous_rotation := tree.rotation
		game.update_wind(0.4)
		check(tree.rotation != previous_rotation, "El viento mueve la vegetación")
	else:
		check(false, "Hay vegetación para comprobar el viento")
	var cells: Array[Vector2i] = []
	for r in range(game.H):
		for c in range(game.W):
			if game.can_build(c, r):
				cells.append(Vector2i(c, r))
	check(cells.size() >= 5, "Hay espacio para las cinco torres")
	if cells.size() < 5:
		quit(1)
		return

	var money: int = game.gold
	game.place_tower("mg", game.spawn_cell)
	check(game.gold == money and game.towers.is_empty(), "No se construye sobre la ruta")
	game.gold = 5000
	for i in range(TDData.TOWER_ORDER.size()):
		game.place_tower(TDData.TOWER_ORDER[i], cells[i])
	check(game.towers.size() == 5, "Se construyen los cinco tipos de torre")
	check(not game.can_build(cells[0].x, cells[0].y), "Una casilla ocupada no admite otra torre")
	check(not game.cell_props.has(cells[0]), "La decoración se retira al construir")
	var tower: Dictionary = game.towers[0]
	check(tower["node"].has_meta("uses_original_model"), "La torre construida conserva el GLB")
	var basic_damage: float = game.tower_stats(tower)["dmg"]
	game.select_at(cells[0])
	game.on_upgrade()
	game.on_upgrade()
	check(tower["level"] == 3 and game.tower_stats(tower)["dmg"] > basic_damage, "Mejoras hasta nivel 3")
	var marker: MeshInstance3D = tower["node"].get_node("IndicadorNivel3")
	check((marker.material_override as StandardMaterial3D).emission_enabled, "La mejora se refleja en las luces")
	money = game.gold
	game.on_upgrade()
	check(game.gold == money and tower["level"] == 3, "No se cobra una mejora por encima del máximo")
	game.on_sell()
	check(game.gold == money + int(floor((100 + 200 + 350) * 0.6)), "La venta devuelve el 60 % de la inversión")
	check(game.can_build(cells[0].x, cells[0].y), "La casilla queda libre tras vender")

	game.spawn_enemy("soldier", false)
	var enemy: Dictionary = game.enemies.back()
	var initial: Vector3 = enemy["pos"]
	game.update_enemies(1.0)
	check(float(enemy["d"]) >= 2.8 and float(enemy["d"]) <= 3.2, "Soldado se mueve con agilidad")
	check((enemy["pos"] as Vector3).distance_to(initial) > 2.5, "El modelo avanza físicamente")
	var before_slow: float = enemy["d"]
	enemy["slow"] = 2.0
	game.update_enemies(1.0)
	check(float(enemy["d"]) - before_slow < 1.7, "Radar ralentiza el desplazamiento")
	check(enemy["node"].has_meta("uses_original_model"), "El enemigo conserva el GLB")

	var ground := {"dead": false, "air": false, "pos": Vector3.ZERO, "d": game.path_total - 5.0}
	var air := {"dead": false, "air": true, "pos": Vector3.ZERO, "d": game.air_total - 2.0}
	game.enemies = [ground, air]
	check(game.find_target(Vector3.ZERO, 10.0, true, true) == air, "Prioridad al enemigo más próximo a la base")
	check(game.find_target(Vector3.ZERO, 10.0, true, false) == ground, "Las torres terrestres no apuntan al aire")
	check(game.find_target(Vector3.ZERO, 10.0, false, true) == air, "Las antiaéreas ignoran objetivos terrestres")

	# Reinicio para probar daño, pausa, habilidades y flujo de oleadas.
	game.start_game()
	await process_frame
	game.gold = 5000
	for i in range(TDData.TOWER_ORDER.size()):
		game.place_tower(TDData.TOWER_ORDER[i], cells[i])
	game.wave = 1
	game.spawn_enemy("soldier", false)
	enemy = game.enemies.back()
	enemy["hp"] = 1000.0
	enemy["pos"] = game.towers[0]["pos"] + Vector3(1.0, 0, 0)
	game.fire(game.towers[0], game.tower_stats(game.towers[0]), enemy)
	check(float(enemy["hp"]) < 1000.0, "Flechas causa daño")
	var hp_before: float = enemy["hp"]
	game.fire(game.towers[1], game.tower_stats(game.towers[1]), enemy)
	game.update_projectiles(2.0)
	check(float(enemy["hp"]) < hp_before, "El proyectil de asedio impacta")
	hp_before = enemy["hp"]
	game.fire(game.towers[2], game.tower_stats(game.towers[2]), enemy)
	check(float(enemy["hp"]) < hp_before, "La torre arcana causa daño")
	game.spawn_enemy("drone", false)
	var drone: Dictionary = game.enemies.back()
	drone["hp"] = 1000.0
	drone["pos"] = enemy["pos"] + Vector3(0, TDData.AIR_Y, 0)
	hp_before = drone["hp"]
	game.fire(game.towers[3], game.tower_stats(game.towers[3]), drone)
	check(float(drone["hp"]) < hp_before, "La antiaérea daña al dron")
	hp_before = enemy["hp"]
	game.fire(game.towers[4], game.tower_stats(game.towers[4]), enemy)
	check(float(enemy["hp"]) < hp_before and float(drone["hp"]) < 952.0, "El rayo encadena objetivos")

	game.on_skill("radar")
	game.cast_skill_at(enemy["pos"])
	check(float(enemy["slow"]) == 8.0 and float(game.skill_cd["radar"]) > 0.0, "Radar aplica ralentización y enfriamiento")
	game.on_skill("shield")
	var lives_before: int = game.lives
	game.reach_base(enemy)
	check(game.lives == lives_before, "El escudo bloquea el daño a la base")
	game.update_skills(11.0)
	check(game.base_shield <= 0.0, "El escudo caduca")
	game.lives = 50
	game.on_skill("heal")
	check(game.lives == 75, "Botiquín restaura vida")
	game.on_skill("misil")
	game.cast_skill_at(drone["pos"])
	check(game.strikes.size() == 6 and float(game.skill_cd["misil"]) > 0.0, "Rayo prepara seis impactos")
	game.update_strikes(2.0)
	check(game.strikes.is_empty(), "Los impactos de Rayo se resuelven")
	hp_before = drone["hp"]
	game.on_skill("nuke")
	check(float(game.skill_cd["nuke"]) > 0.0 and float(drone["hp"]) < hp_before, "Bomba daña enemigos y entra en enfriamiento")

	game.start_game()
	await process_frame
	game.on_start_wave()
	game._process(1.0)
	check(game.wave == 1 and game.wave_active and not game.enemies.is_empty(), "La primera oleada genera enemigos")
	drone = game.enemies[0]
	before_slow = drone["d"]
	game.toggle_pause()
	game._process(1.0)
	check(float(drone["d"]) == before_slow, "La pausa detiene el juego")
	game.toggle_pause()
	game._process(1.0)
	check(float(drone["d"]) > before_slow, "Reanudar mueve a los enemigos")
	game.wave = TDData.MAX_WAVE
	game.end_wave()
	check(game.over and game.end_root.visible and game.lbl_end_title.text == "¡VICTORIA!", "Victoria tras la última oleada")
	game.on_restart()
	check(not game.over and game.wave == 0 and game.lives == TDData.START_LIVES, "Reiniciar restablece la partida")
	game.lives = 1
	game.spawn_enemy("soldier", false)
	game.reach_base(game.enemies.back())
	check(game.over and game.lbl_end_title.text == "DERROTA", "Derrota al agotar las vidas")
	game.on_menu()
	check(not game.in_game and game.menu_root.visible, "Regreso al menú")

	print("Pruebas: %d comprobaciones, %d fallos" % [checks, failures.size()])
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
