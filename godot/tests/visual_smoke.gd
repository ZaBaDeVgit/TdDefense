# Prueba con ventana y renderizador real (por ejemplo, bajo Xvfb en CI).
extends SceneTree

func _initialize() -> void:
	call_deferred("run_visual_smoke")

func run_visual_smoke() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	if scene == null:
		printerr("FALLO: no se pudo cargar la escena")
		quit(1)
		return
	var game = scene.instantiate()
	root.add_child(game)
	await process_frame
	game.rng.seed = 4321
	game.on_play(0)
	game.gold = 5000
	var count := 0
	for r in range(game.H):
		for c in range(game.W):
			if game.can_build(c, r) and count < TDData.TOWER_ORDER.size():
				game.place_tower(TDData.TOWER_ORDER[count], Vector2i(c, r))
				count += 1
	game.on_start_wave()
	# Ceder varios fotogramas al renderizador y a las animaciones de construcción.
	for i in range(30):
		await process_frame
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	if image == null or image.is_empty():
		printerr("FALLO: el renderizador no produjo una imagen")
		quit(1)
		return
	var colors := {}
	for y in range(8):
		for x in range(8):
			var px := roundi(float(x) * float(image.get_width() - 1) / 7.0)
			var py := roundi(float(y) * float(image.get_height() - 1) / 7.0)
			colors[image.get_pixel(px, py).to_html(false)] = true
	if colors.size() < 5:
		printerr("FALLO: la imagen renderizada está vacía o es uniforme")
		quit(1)
		return
	var output := OS.get_environment("TD_VISUAL_IMAGE")
	if not output.is_empty():
		image.resize(480, 270, Image.INTERPOLATE_LANCZOS)
		image.save_jpg(output, 0.35)
	print("VISUAL: imagen renderizada; %d colores distintos en la muestra" % colors.size())
	game.queue_free()
	await process_frame
	# Liberar las cachés estáticas antes de cerrar el renderizador.
	TDModels._mats.clear()
	TDModels._soft_noise = null
	TDModels._camo_noise = null
	TDFx._soft = null
	await process_frame
	await RenderingServer.frame_post_draw
	quit(0)
