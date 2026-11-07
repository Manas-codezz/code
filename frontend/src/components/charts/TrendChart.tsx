import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend, type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { TrendPoint } from '../../api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend)

const ACCENT = '#a393bf'
const SAGE = '#c3dac3'
const WARN = '#d9b978'
const GRID = '#2a2633'
const FAINT = '#6e6878'

export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const labels = points.map((p) => p.date.slice(5))

  const data = {
    labels,
    datasets: [
      {
        label: 'Approved',
        data: points.map((p) => p.approved),
        borderColor: SAGE,
        backgroundColor: 'rgba(195,218,195,0.10)',
        fill: true,
        tension: 0.32,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
      {
        label: 'Created',
        data: points.map((p) => p.created),
        borderColor: ACCENT,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.32,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
      {
        label: 'Findings',
        data: points.map((p) => p.findings),
        borderColor: WARN,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.32,
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 3,
      },
    ],
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
        labels: {
          color: FAINT,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          font: { family: 'IBM Plex Sans', size: 11 },
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#1a1720',
        borderColor: GRID,
        borderWidth: 1,
        titleColor: '#ece9f0',
        bodyColor: '#9a93a6',
        titleFont: { family: 'IBM Plex Mono', size: 11 },
        bodyFont: { family: 'IBM Plex Sans', size: 11 },
        padding: 10,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: { color: GRID, drawTicks: false },
        border: { display: false },
        ticks: {
          color: FAINT,
          font: { family: 'IBM Plex Mono', size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID, drawTicks: false },
        border: { display: false },
        ticks: {
          color: FAINT,
          font: { family: 'IBM Plex Mono', size: 10 },
          precision: 0,
        },
      },
    },
  }

  return (
    <div className="h-[240px]">
      <Line data={data} options={options} />
    </div>
  )
}
