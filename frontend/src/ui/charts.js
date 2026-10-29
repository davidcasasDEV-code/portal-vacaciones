import { Chart, BarController, BarElement, DoughnutController, ArcElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } from 'chart.js';

Chart.register(BarController, BarElement, DoughnutController, ArcElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function themeDefaults() {
  Chart.defaults.font.family = css('--font') || 'system-ui';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = css('--muted');
  Chart.defaults.borderColor = css('--border');
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor = '#0f2a47';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.maintainAspectRatio = false;
}

const live = new Set();
window.addEventListener('themechange', () => {
  themeDefaults();
  for (const c of live) {
    if (!c.canvas.isConnected) {
      live.delete(c);
      continue;
    }
    for (const axis of Object.values(c.options.scales || {})) {
      if (axis.grid) axis.grid.color = css('--border');
      if (axis.ticks) axis.ticks.color = css('--muted');
    }
    c.options.plugins.legend.labels.color = css('--muted');
    c.update('none');
  }
});

export function chart(canvas, config) {
  themeDefaults();
  const c = new Chart(canvas, config);
  live.add(c);
  return c;
}

export const stackedBar = (canvas, labels, datasets, { horizontal = false } = {}) =>
  chart(canvas, {
    type: 'bar',
    // Separación de 2px (color de la superficie) entre segmentos apilados
    data: { labels, datasets: datasets.map((d) => ({ borderRadius: 4, maxBarThickness: 34, borderColor: css('--surface'), borderWidth: horizontal ? { right: 2 } : { top: 2 }, borderSkipped: false, ...d })) },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true, grid: { display: horizontal } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { display: !horizontal } },
      },
    },
  });

export const doughnut = (canvas, labels, data, colors) =>
  chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: css('--surface') }] },
    options: { cutout: '64%', plugins: { legend: { position: 'right' } } },
  });

