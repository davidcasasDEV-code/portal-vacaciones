// Paleta de gráficas validada para daltonismo (scripts/validate_palette.js de la skill dataviz):
// 8 tonos en orden fijo, con su variante para modo oscuro. No se agregan tonos generados.
import { currentTheme } from '../state.js';

export const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

const DARK_OF = Object.fromEntries(SERIES.light.map((h, i) => [h, SERIES.dark[i]]));

const isDark = () => currentTheme() === 'dark';

// Color de un beneficio ajustado al tema (los colores propios del Admin se respetan tal cual).
export const tone = (hex) => (isDark() ? DARK_OF[String(hex || '').toLowerCase()] || hex : hex);

// i-ésimo color en orden fijo (para listas de 8 elementos o menos).
export const series = (i) => SERIES[isDark() ? 'dark' : 'light'][i % 8];

// Saldos: usados / por disfrutar / disponibles (validado con todos los pares).
export const balance = () => ({ usado: series(1), porDisfrutar: series(2), disponible: series(0) });
