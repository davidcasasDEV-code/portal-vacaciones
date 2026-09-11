// Festivos oficiales MX 2024-2027, tal como vivian hardcodeados en el
// frontend anterior (js/vacaciones.js). Se centralizan aqui para que el
// calculo de dias habiles se haga una sola vez, en el servidor.
export const HOLIDAYS = {
  "2024-01-01": "Año Nuevo",
  "2024-02-05": "Aniversario de la constitución",
  "2024-03-18": "Natalicio Benito Juárez",
  "2024-05-01": "Día del Trabajo",
  "2024-09-16": "Día de la Independencia",
  "2024-11-18": "Revolución Mexicana",
  "2024-12-25": "Navidad",
  "2025-01-01": "Año Nuevo",
  "2025-02-03": "Aniversario de la constitución",
  "2025-03-17": "Natalicio Benito Juárez",
  "2025-04-17": "Semana Santa",
  "2025-04-18": "Semana Santa",
  "2025-05-01": "Día del Trabajo",
  "2025-09-16": "Día de la Independencia",
  "2025-11-17": "Revolución Mexicana",
  "2025-12-24": "Noche Buena",
  "2025-12-25": "Navidad",
  "2025-12-31": "Ultimo día del Año",
  "2026-01-01": "Año Nuevo",
  "2026-02-02": "Aniversario de la constitución",
  "2026-03-16": "Natalicio Benito Juárez",
  "2026-04-02": "Semana Santa",
  "2026-04-03": "Semana Santa",
  "2026-05-01": "Día del Trabajo",
  "2026-09-16": "Día de la Independencia",
  "2026-11-16": "Revolución Mexicana",
  "2026-12-24": "Noche Buena",
  "2026-12-25": "Navidad",
  "2026-12-31": "Ultimo día del Año",
  "2027-01-01": "Año Nuevo"
};

export function isHoliday(isoDate) {
  return Boolean(HOLIDAYS[isoDate]);
}

export function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function toIsoDate(date) {
  return date.toISOString().split("T")[0];
}

// Cuenta los dias habiles (no fin de semana, no festivo) entre dos fechas
// "yyyy-mm-dd" inclusive, igual que hacia el frontend anterior.
export function businessDaysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = toIsoDate(cursor);
    if (!isWeekend(cursor) && !isHoliday(iso)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
