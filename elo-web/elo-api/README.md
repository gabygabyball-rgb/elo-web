# Elo API

API REST de solo lectura para tu bot de Elo. Independiente de cualquier página web: cualquier programa
(otra web, otro bot, un overlay, una hoja de cálculo) puede pedirle el ranking. No tiene dependencias, solo Node 18+.

## Instalar y encender

1. Copia la carpeta `elo-api/` dentro de la carpeta de tu bot, al lado de `src/` y `data/`.
2. (Opcional) copia `.env.example` a `.env` y pon tu `API_KEY`.
3. Enciéndela:

```
node elo-api/server.js
```

Prueba: abre http://localhost:4000/api/v1/leaderboard. Si el bot todavía no tiene partidas, usa `DEMO=1` para ver jugadores de ejemplo.
Para dejarla siempre encendida: `npm i -g pm2` y `pm2 start elo-api/server.js --name elo-api`.

Como lee `data/db.json`, tiene que correr en la misma máquina que el bot. Para abrirla a internet, ponle un dominio con HTTPS
(Caddy: `api.tudominio.com { reverse_proxy localhost:4000 }`) y **define `API_KEY`**.


Solo lectura: lee el `db.json` de tu bot y nunca lo modifica. Responde JSON.
Es un programa independiente de la página web: se enciende solo y tiene su propio puerto (4000).

```
http://localhost:4000/api/v1
```

## Clave (opcional pero recomendada)

Si pones `API_KEY` en `web/.env`, todas las rutas piden la clave:

```
curl -H "Authorization: Bearer TU_CLAVE" http://localhost:4000/api/v1/leaderboard
```

(También vale la cabecera `X-API-Key: TU_CLAVE`.) Sin clave configurada la API es pública, que está bien si solo expone el ranking.
Límite por defecto: 60 peticiones por minuto por IP (`429` si te pasas).

## Rutas

| Ruta | Qué devuelve |
|---|---|
| `GET /api/v1` | Lista de rutas |
| `GET /api/v1/health` | `{ ok, hasData, season }` para saber si el servidor ve el `db.json` |
| `GET /api/v1/ranks` | La escalera de rangos (Bronce … Pro) con el Elo mínimo de cada división |
| `GET /api/v1/boards` | Los modos con ranking (`4v4-solo`, `1v1-solo`, …) y cuántos jugadores tiene cada uno |
| `GET /api/v1/leaderboard?board=KEY&limit=10&offset=0` | Ranking ordenado por Elo. `limit` máx. 100. Sin `board` usa el modo con más jugadores. Con `avatars=1` agrega la foto de los primeros 25 (necesita `DISCORD_TOKEN`) |
| `GET /api/v1/players/:discordId` | Perfil del jugador en cada modo: puesto, Elo, rango, victorias/derrotas/empates, % de victorias, rachas, mejor y peor Elo, y los últimos 50 valores de Elo |
| `GET /api/v1/games?board=KEY&limit=10` | Últimas partidas terminadas (máx. 50): equipos, resultado y cuánto Elo cambió cada jugador |

Solo cuentan jugadores con al menos una partida jugada.

## Ejemplo de respuesta

`GET /api/v1/leaderboard?limit=2`

```json
{
  "season": 7,
  "board": { "key": "4v4-solo", "name": "4v4-solo" },
  "total": 7, "limit": 2, "offset": 0,
  "players": [
    { "position": 1, "id": "100000000000000000", "name": "Mbappé10", "elo": 1830,
      "rank": { "key": "maestro", "name": "Maestro I", "emoji": "👑", "color": "#ff3b6b" },
      "wins": 30, "losses": 10, "draws": 2, "games": 42, "winRate": 71.4, "streak": 2 }
  ],
  "demo": false
}
```

## Errores

`401` clave incorrecta · `404` jugador o modo que no existe · `405` solo se permite GET · `429` demasiadas peticiones.
Todos devuelven `{ "error": "mensaje en español" }`.

## Usarla desde otro programa

Para sus propios comandos el bot no la necesita (ya tiene los datos en `database.js`). Sirve para una página en otro
dominio, otro bot, un overlay de stream o una hoja de cálculo:

```js
const r = await fetch('http://localhost:4000/api/v1/leaderboard?limit=5', { headers: { Authorization: 'Bearer ' + process.env.ELO_API_KEY } });
const { players } = await r.json();
```

## Qué no hace (a propósito)

No tiene rutas para cambiar Elo ni registrar resultados. Esos datos solo los escribe el bot, y una ruta de escritura
expuesta a internet permitiría que cualquiera se suba el Elo. Si más adelante la necesitas (para la tienda o las
apuestas), lo seguro es que el propio bot la llame con una clave y se agregue entonces.
