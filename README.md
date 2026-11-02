# TD Defense

Juego Tower Defense militar futurista en 3D (Three.js), en español, inspirado en el diseño de referencia
`Tablero de defensa militar futurista.png`.

## Características
- **5 torres** con modelos 3D procedurales y 3 niveles de mejora: Ametralladora ($100), Misiles ($150), Láser ($200), Antiaérea ($250, solo aéreos) y Eléctrica ($300, cadena de rayos).
- **8 enemigos**: Soldado, Soldado Escudo, Araña Robot, Jeep Armado, Tanque, Camión Blindado, Dron y Helicóptero (aéreos). Jefes en las oleadas 5, 10 y 15.
- **4 escenarios**: Base Militar, Desierto, Montaña y Ciudad, cada uno con su propia ruta, decoración y ambiente.
- **15 oleadas** por partida, con bonificación de oro al superarlas.
- **Habilidades**: bombardeo de misiles, radar (ralentiza), ataque nuclear, escudo de base y botiquín.
- **Efectos**: partículas, explosiones, haces láser, arcos eléctricos, bloom, sombras, humo de misiles, textos flotantes.
- **HUD**: vida, oro, oleada, minimapa, panel de enemigos, mejoras, pausa, velocidad x2, ajustes (sonido sintetizado, calidad, rangos).

## Controles
| Acción | Control |
|---|---|
| Construir torre | Clic en la torre de la barra inferior y luego en una casilla verde |
| Seleccionar / mejorar / vender | Clic en una torre (panel MEJORAS) · tecla `V` para modo vender |
| Iniciar oleada | Botón ▶ Oleada o `Espacio` |
| Pausa | `P` o `Esc` |
| Torres rápidas | `1`–`5` |
| Rotar cámara | Clic derecho + arrastrar |
| Zoom | Rueda del ratón |
| Mover cámara | Flechas |
| Cancelar modo | Clic derecho o `Esc` |

## Ejecutar en desarrollo
```bash
npm install
npm run dev        # http://localhost:5173
```

## Generar el ejecutable (Windows)
```bash
npm install
npm run exe        # genera release/TDDefense.exe (y build/TDDefense-linux para pruebas)
```
`TDDefense.exe` es un único archivo: contiene el juego completo y un servidor local que solo escucha en `127.0.0.1`.
Al ejecutarlo abre el juego en una ventana de Microsoft Edge/Chrome (modo aplicación) o en el navegador predeterminado.
Cierra la consola para salir.

Para probar el lanzador en Linux sin empaquetar: `npm run exe:linux` y luego `./build/TDDefense-linux`.

## Estructura
- `index.html`, `src/style.css` — interfaz (menús, HUD, paneles).
- `src/main.js` — renderizado, cámara, entrada, HUD y bucle principal.
- `src/game.js` — lógica: oleadas, torres, enemigos, habilidades, economía.
- `src/models.js` — modelos 3D procedurales (torres, enemigos, props, base).
- `src/effects.js` — partículas, haces, arcos, anillos, textos.
- `src/audio.js` — sonidos sintetizados con WebAudio.
- `src/maps.js` — escenarios en rejilla ASCII; la ruta se calcula automáticamente.
- `launcher/sea-main.cjs` — lanzador empaquetado en el `.exe` (Node SEA).
- `scripts/build-exe.mjs` — compila el juego y genera el `.exe`.
