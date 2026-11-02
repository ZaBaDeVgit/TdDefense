# TD Defense en Godot

Abre `project.godot` con **Godot 4.3 o superior**, espera a que termine la importación de los modelos GLB y pulsa **F5**. El juego utiliza Forward+; si es necesario, baja la opción **Gráficos** dentro de la partida.

Construye torres con un clic o arrastrándolas desde la barra inferior. Selecciona una torre para mejorarla o venderla. Pulsa **Espacio** para iniciar cada oleada; **1–5** seleccionan torres, **Esc/P** pausa, la rueda cambia el zoom y el botón central desplaza la cámara. Rayo y Radar requieren elegir un objetivo en el mapa.

Hay cuatro escenarios, quince oleadas, cinco torres con tres niveles y cinco habilidades. Las rutas tienen curvas suavizadas, los enemigos se desplazan con mayor agilidad y el terreno incluye agua, viento y sombras.

Desde la raíz del repositorio se pueden ejecutar las pruebas automatizadas:

```sh
godot --headless --path godot --import
godot --headless --path godot --script res://tests/run_tests.gd
```

Las pruebas sin ventana no sustituyen una comprobación visual con Godot. Encontrarás controles y más información en el `README.md` de la raíz. Los modelos y sus créditos se conservan en `assets/models/CREDITOS_MODELOS.txt`.
