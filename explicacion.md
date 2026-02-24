# Tipster Analyzer — Documentación técnica del proyecto

## Qué es esto

Un bookmarklet JavaScript que se ejecuta en la página de un tipster de **Blogabet** y genera un popup de análisis completo: muestra, rendimiento, seguibilidad, gráfico histórico, y un portfolio builder interactivo con preselección inteligente de categorías.

El objetivo no es solo ver si un tipster gana dinero, sino entender **si ese dinero es real, reproducible, y seguible** por un usuario normal.

---

## Arquitectura general

scrapeTipsterData()
↓
buildProfitability() buildConsistency() buildSpecialization() buildFollowability()
↓ ↓ ↓ ↓
computeScores()
↓
getFollowVerdict()
↓
renderPopup()
↓
initChart() + initPortfolio()

text

Todo ocurre en una IIFE async. No hay dependencias externas salvo Chart.js (cargado dinámicamente solo si hace falta).

---

## Fuente de datos: qué nos da Blogabet y cómo lo extraemos

Blogabet no tiene API pública. Los datos se obtienen haciendo **fetch autenticado** a dos endpoints internos:

### `/blog/stats`
Devuelve el HTML completo de la página de estadísticas. De aquí extraemos:

| Sección | ID del DOM | Qué contiene |
|---|---|---|
| Archive all-time | `alltime-archive-StatsTabContent` | Yield y picks por mes desde el inicio |
| Categorías | `alltime-categories-StatsTabContent` | Yield, picks, WR, profit por liga/deporte |
| Tipos de pick | `alltime-pick_types-StatsTabContent` | Ratio live vs prematch |
| Stakes | `alltime-stakes-StatsTabContent` | Distribución por stake |
| Hora del día | `alltime-hour_of_the_day-StatsTabContent` | Actividad por franja horaria |
| Horas al evento | `alltime-hours_to_event-StatsTabContent` | Antelación media de los picks |

La función `parseSection(sectionId)` lee el `<table>` dentro de cada contenedor, extrae los headers del `<thead>` y mapea cada fila a un objeto `{ header: value }`.

**Problema con los nombres de categorías:** el DOM de Blogabet duplica el nombre de la liga en el texto de la celda (ej. `"Livebet Livebet"`). Se resuelve cogiendo solo la primera mitad del string y combinándola con el atributo `title` del icono de deporte.

**Yield all-time:** no usamos el valor del header de la página porque puede estar redondeado. Lo recalculamos como yield **ponderado por picks** mes a mes desde el archive:
yieldTotal = Σ(yield_mes × picks_mes) / Σ(picks_mes)

text

### `/blog/picks` (con filtros)
Se usa en `fetchCategoryYield()` para obtener el yield reciente de cada categoría importante. Se hacen **dos llamadas en paralelo** por categoría: una filtrando los últimos 12 meses de archive y otra los últimos 6. Esto nos da `recentYield` (12m) y `recentYield6` (6m).

Los IDs de categoría y de los meses de archive se extraen de los `<input name="filters[categories][]">` y `<input name="filters[archive][]">` que Blogabet usa en sus formularios de filtro internos.

---

## Los 4 módulos de análisis

### 1. `buildProfitability(td)`

Transforma las categorías raw en objetos normalizados con:
- `name`, `sport`, `league` (separados del string `"Sport - League"`)
- `picks`, `yield`, `wr`, `profit`, `oddsAvg`
- `reliable`: si `picks >= 15` (mínimo estadístico básico)
- `liquid`: si la liga aparece en la lista hardcodeada de mercados líquidos (Premier League, Serie A, Champions, NBA, ATP, etc.)

La distinción **líquido/ilíquido** es fundamental porque una liga ilíquida puede tener yield alto pero ser imposible de replicar en casas de apuestas convencionales.

### 2. `buildConsistency(td)`

Analiza la evolución temporal usando el archive mensual. Lo primero es **ordenar los meses cronológicamente** porque Blogabet los devuelve en orden arbitrario.

Métricas calculadas:

**Win rate mensual:** % de meses con yield > 0. Un tipster bueno debería estar por encima del 70-75%.

**Tendencia (últimos 3 meses vs histórico):**
avgRecent = yield ponderado de los últimos 3 meses
avgHistoric = yield ponderado del resto
diff = avgRecent - avgHistoric
→ mejorando si diff > 5, bajista si diff < -5, estable en otro caso

text
Se usa yield **ponderado por picks** y no media simple para que un mes con 2 picks no distorsione igual que uno con 200.

**Cambio de odds medias:** compara las odds medias recientes (últimos 3 meses) vs históricas. Si el ratio cambia más del 15%, es señal de que el tipster ha cambiado de estrategia o está apostando en mercados diferentes. Esto puede explicar caídas de yield que parecen aleatorias.

**Drawdown máximo consecutivo:** suma acumulada de yields negativos en rachas consecutivas de meses en rojo. Relevante para calcular el bankroll necesario.

**Overbetting:** compara picks/mes recientes vs histórico. Si reciente > histórico × 2 y el histórico tiene suficiente muestra (>10 picks/mes), se considera overbetting — señal de que el tipster está apostando más de lo habitual, posiblemente para recuperar pérdidas.

**Yield reciente 12m:** yield ponderado de los últimos 12 meses. Es el dato más relevante para decidir si seguir a alguien ahora mismo.

### 3. `buildSpecialization(profitability)`

Clasifica cada categoría en un tag según yield, liquidez y muestra:

| Tag | Condición |
|---|---|
| `star` | yield ≥ 20% + líquida + picks ≥ 50 |
| `star_illiquid` | yield ≥ 20% + ilíquida + picks ≥ 50 |
| `watch_yield` | yield ≥ 12% + líquida, o yield ≥ 20% + líquida + picks < 50 |
| `watch_illiquid` | yield ≥ 12% + ilíquida, o yield ≥ 20% + ilíquida + picks < 50 |
| `positive` | yield > 0 pero por debajo de los umbrales anteriores |
| `negative` | yield ≤ 0 |
| `low_sample` | picks < 15 (sin muestra suficiente para ninguna conclusión) |

El umbral de 15 picks es el mínimo para que una categoría aparezca en el análisis. El de 50 picks para ser considerada "especialidad fiable".

### 4. `buildFollowability(td)`

Evalúa si el tipster es **replicable** por un seguidor normal. Parte de un score de 100 y descuenta:

- `liveRatio >= 80%` → -40 pts (picks casi incopiables en tiempo real)
- `liveRatio >= 60%` → -25 pts
- `liveRatio >= 40%` → -10 pts
- `anticipationPct >= 90%` → -30 pts (menos de 1h de antelación)
- `anticipationPct >= 70%` → -15 pts

Adicionalmente se ajusta en `computeScores()` según el ratio de picks en mercados líquidos.

---

## `computeScores()`: los 3 scores /100

### Score Muestra
Combina dos subscores al 50%:
- **Picks score:** 0→30 (<100 picks), 30→60 (100-200), 60→100 (200-400+)
- **Meses score:** 0→40 (<6 meses), 40→70 (6-12), 70→100 (12-24+)

### Score Rendimiento
yieldScore = yScore(globalYield) × 0.4
+ yScore(recentYield12m) × 0.4
+ catsScore × 0.2
+ categoryBonus

text
Donde:
- `yScore`: 0 (<0%), 20 (0-5%), 40 (5-12%), 65 (12-20%), 85 (20-30%), 100 (>30%)
- `catsScore`: 20 puntos por cada categoría líquida fiable con yield ≥ 12%, 10 por ilíquida (máx 100)
- `categoryBonus`: ±15 pts según si el yield reciente de las categorías recomendadas está subiendo o bajando

### Score Seguibilidad
Base del `followability.baseScore` (ya con descuentos por live/antelación), ajustado por:
- `liquidPicksRatio >= 75%` → +10
- `liquidPicksRatio >= 50%` → -10
- `liquidPicksRatio >= 25%` → -25
- `liquidPicksRatio < 25%` → -40

---

## Portfolio Builder — lógica de preselección

La tabla de categorías muestra solo las que cumplen:
- `picks >= 50` (muestra mínima fiable)
- `yield > 0` (positivas)
- `yield >= 12` (rentabilidad mínima)

Ordenadas por **picks descendente** para ver primero las más representativas.

### Algoritmo de preselección óptima

El objetivo es encontrar la combinación de categorías que maximiza el yield combinado ponderado sin dejarse llevar solo por yields altos con muestra insignificante ni por volumen alto con yield pobre.

La métrica utilizada es:
score = yield × √picks

text

La raíz cuadrada del número de picks actúa como factor de confianza: una categoría con 200 picks pesa √200 ≈ 14.1, pero una con 2000 picks solo pesa √2000 ≈ 44.7 — es decir, el volumen importa pero con rendimientos decrecientes. Así, un yield alto con muestra media puede competir con un yield bajo con muestra muy alta.

```javascript
const candidates = allCats.filter(c => c.yield >= 12 && c.picks >= 50);
const scored = candidates.map(c => ({ ...c, score: c.yield * Math.sqrt(c.picks) }));
const avgScore = scored.reduce((s, c) => s + c.score, 0) / scored.length;
const preselected = new Set(
    scored.filter(c => c.score >= avgScore).map(c => c.name)
);
Se preseleccionan las categorías con score por encima de la media del grupo. Esto es dinámico: si el tipster es muy bueno en general, el umbral sube; si es mediocre, baja.

El yield combinado se calcula en tiempo real al marcar/desmarcar checkboxes como yield ponderado por picks:

text
combinedYield = Σ(yield_cat × picks_cat) / Σ(picks_cat)
Gráfico histórico
Gráfico mixto con Chart.js:

Líneas: una por año, yield mensual. Los años anteriores a los últimos 2 se ocultan por defecto para no saturar.

Puntos rojos: meses con picks por encima del 120% de la media del año → señal de overbetting.

Barras: media histórica de picks por mes (todos los años combinados), eje derecho comprimido al 25% para no tapar las líneas.

Fondo verde/rojo: plugin custom que colorea el área sobre/bajo el eje 0.

Veredicto final (getFollowVerdict)
Tres posibles decisiones con sus condiciones:

Decisión	Condición
✅ Recomendado	yieldScore ≥ 70 + muestraScore ≥ 60 + tiene stars o especialidad + seguibilidad no baja
👀 En vigilancia	yieldScore ≥ 50 + muestraScore ≥ 50
❌ No recomendado	resto de casos
El veredicto incluye listas de puntos débiles (tendencia bajista, drawdown alto, overbetting, cambio de odds, live ratio alto) y puntos fuertes (yield sólido, categorías con edge, seguibilidad alta, muestra robusta).

Decisiones de diseño relevantes
Yield ponderado vs media simple: siempre ponderado por picks. Una media simple daría el mismo peso a un mes con 3 picks que a uno con 300.

Liquidez hardcodeada: la lista de ligas líquidas es estática. Es una simplificación consciente — cubrir el 95% de los casos sin necesidad de API externa.

fetchCategoryYield en paralelo: las dos llamadas (12m y 6m) se hacen en Promise.all para reducir el tiempo de carga.

Secciones colapsadas por defecto: el popup tiene mucha información. Empezar colapsado obliga al usuario a explorar activamente en lugar de sentirse abrumado.

yield × √picks para preselección: descartamos profit puro (yield × picks) porque penalizaba demasiado las categorías pequeñas, y descartamos yield puro porque ignoraba la fiabilidad estadística.