# TD Defense — versión Godot 4 (Windows)

Juego de tower defense militar futurista hecho con **Godot 4.3** (GDScript).
Es la versión nueva del proyecto: se ejecuta directamente desde el editor de Godot.

## 1. Instalar Godot (una vez)

1. Entra en https://godotengine.org/download/windows/ y descarga **Godot Engine 4.3 – Standard** (zip de 64 bits, *no* la versión .NET/Mono).
2. Descomprime el zip en una carpeta, por ejemplo `C:\Godot\`. Godot es un único `.exe` portable; no necesita instalación.

## 2. Abrir y ejecutar el juego

1. Abre `Godot_v4.3-stable_win64.exe`.
2. En el gestor de proyectos pulsa **Importar** y selecciona el archivo `godot/project.godot` de esta carpeta.
3. Pulsa **Importar y editar**. La primera vez Godot crea su caché; espera unos segundos.
4. Pulsa **F5** (o el botón ▶ arriba a la derecha) para jugar.

## 3. Controles (solo ratón)

| Acción | Control |
|---|---|
| Elegir torre | Pulsa una torre en la barra inferior, luego clic en una casilla verde |
| Arrastrar torre | Mantén pulsada una torre en la barra inferior y suéltala sobre una casilla verde |
| Seleccionar / mejorar / vender | Clic sobre una torre construida → panel con **Mejorar** y **Vender** |
| Cancelar | **Clic derecho** (o Esc) |
| Iniciar oleada | Botón **▶ Oleada** |
| Habilidades | Botones de la barra inferior (Misiles y Radar piden un objetivo con clic) |
| Pausa / Menú | Botones **Pausa** y **Menú** de la barra superior (Esc también pausa) |
| Calidad gráfica | Botón **Gráficos** (Baja / Media / Alta); el contador **FPS** está arriba a la derecha |
| Mover cámara | Arrastrar con el **botón central**, o acercar el ratón a los bordes de la pantalla |
| Zoom | Rueda del ratón |

## 4. Contenido

- 5 torres: Ametralladora ($100), Misiles ($150), Láser ($200), Antiaérea ($250), Eléctrica ($300). Mejoras hasta nivel 3.
- Enemigos terrestres y aéreos (soldados, escudos, arañas, jeeps, tanques, camiones, drones, helicópteros) con jefes en las oleadas 5, 10 y 15.
- 4 escenarios: Base Militar, Desierto, Montaña y Ciudad.
- 15 oleadas por mapa, vida 100, oro inicial 850.
- 5 habilidades: Misiles (bombardeo), Radar (ralentiza), Nuclear, Escudo de base (10 s) y Botiquín (+25 vida).

Los datos de torres, enemigos, oleadas y mapas se han portado desde la versión web (`src/`), así que el equilibrio es el mismo.

## 5. Estructura

```
godot/
  project.godot          configuración del proyecto
  scenes/main.tscn       escena única (raíz con main.gd)
  scripts/main.gd        lógica del juego, menús, HUD, entrada
  scripts/data.gd        torres, enemigos, oleadas, escenarios (mapas)
  scripts/models.gd      modelos 3D procedurales (torres, enemigos, decoración)
  scripts/fx.gd          efectos: explosiones, humo, destellos, rayos, textos
```

## 6. Exportar a .exe (opcional)

En el editor: **Proyecto → Exportar… → Añadir… → Windows Desktop**, pulsa **Exportar proyecto** y guarda el `.exe`.
La primera vez Godot pide descargar las *plantillas de exportación* (**Editor → Gestionar plantillas de exportación → Descargar e instalar**).

## 7. Si algo falla

Copia el texto del panel **Salida** (o **Depurador**, abajo en el editor) y envíalo al chat junto con lo que estabas haciendo.
Esta versión se ha escrito sin poder ejecutarla en el entorno de desarrollo, así que los primeros errores de compilación son posibles y se corrigen rápido con ese texto.
