# TD Defense

Juego de defensa de torres en 3D para **Godot 4.3 o superior**, en español. El proyecto nativo está en [`godot/`](godot/): conserva los modelos originales de ZaBaDeV y los cuatro escenarios existentes.

## Abrir y jugar

1. Descarga la versión estándar de [Godot 4](https://godotengine.org/download/) (no hace falta .NET).
2. En el gestor de proyectos selecciona **Importar** y elige `godot/project.godot`.
3. Espera a que termine la primera importación de los modelos y pulsa **F5**.

El proyecto usa el renderizador **Forward+**. Si el equipo tiene dificultades de rendimiento, cambia **Gráficos** a Media o Baja durante la partida. Para exportar un ejecutable, instala las plantillas de exportación de la misma versión de Godot y utiliza **Proyecto → Exportar**.

## Cómo se juega

Defiende la base durante 15 oleadas. Empiezas con 100 vidas y 850 de oro; eliminar enemigos y completar oleadas da oro para construir y mejorar.

- Cinco torres con modelos originales, alcance y funciones distintas; se pueden mejorar hasta el nivel 3 o vender por el 60 % de lo invertido.
- Enemigos terrestres y aéreos, con jefes en las oleadas 5, 10 y 15.
- Cuatro escenarios: Base Militar, Desierto, Montaña y Ciudad.
- Cinco habilidades: Rayo, Radar, Bomba, Escudo de base y Botiquín.
- Rutas redondeadas y movimiento más ágil, vegetación con viento, agua animada y sombras configurables. El suelo de fuego original se conserva en el portal de entrada.

| Acción | Control |
|---|---|
| Construir | Clic en una torre y luego en una casilla libre, o arrastrar la torre desde la barra |
| Mejorar / vender | Clic en una torre construida y usar su panel |
| Torres rápidas | Teclas **1–5** |
| Iniciar oleada | Botón **▶ Oleada** o **Espacio** |
| Habilidades | Botones inferiores; Rayo y Radar requieren elegir un punto del mapa |
| Pausa | **Esc**, **P** o botón Pausa |
| Cancelar selección | Clic derecho o **Esc** |
| Mover cámara | Arrastrar con el botón central o acercar el cursor a los bordes |
| Zoom | Rueda del ratón |

## Pruebas de lógica

Con Godot instalado y desde la raíz del repositorio:

```sh
godot --headless --path godot --import
godot --headless --path godot --script res://tests/run_tests.gd
```

Las pruebas comprueban los modelos importados, rutas, construcción, mejoras, combate, habilidades y flujo de partida. Además, la integración continua comprueba que se renderice una imagen con OpenGL por software. Ninguna sustituye una revisión visual en Forward+ con una GPU compatible.

## Créditos

Modelos, texturas y efectos originales: **ZaBaDeV**. Detalles y condiciones de uso en [`godot/assets/models/CREDITOS_MODELOS.txt`](godot/assets/models/CREDITOS_MODELOS.txt). `Tablero de defensa militar futurista.png` es la referencia visual original del proyecto.
