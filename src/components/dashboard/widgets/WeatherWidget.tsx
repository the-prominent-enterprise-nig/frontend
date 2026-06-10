import { Sun, Cloud, CloudRain, Wind, Droplets } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const FORECAST = [
  { day: 'Mon', icon: Sun, high: 32, low: 26 },
  { day: 'Tue', icon: Cloud, high: 29, low: 24 },
  { day: 'Wed', icon: CloudRain, high: 27, low: 23 },
  { day: 'Thu', icon: Sun, high: 33, low: 27 },
  { day: 'Fri', icon: Cloud, high: 30, low: 25 },
]

export default function WeatherWidget() {
  const { variant } = useWidgetSize()
  const isXs = variant === 'xs'

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-bold text-zinc-900 leading-none ${isXs ? 'text-3xl' : 'text-4xl'}`}>
            32°C
          </p>
          <p className={`text-zinc-500 mt-1 truncate ${isXs ? 'text-[10px]' : 'text-xs'}`}>
            Partly Cloudy — Manila
          </p>
        </div>
        <Sun className={`shrink-0 text-amber-400 ${isXs ? 'h-10 w-10' : 'h-14 w-14'}`} />
      </div>

      {variant !== 'xs' && (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
            68%
          </span>
          <span className="flex items-center gap-1">
            <Wind className="h-3.5 w-3.5 text-zinc-400" />
            14 km/h
          </span>
        </div>
      )}

      {variant === 'lg' && (
        <div className="mt-auto flex justify-between border-t border-zinc-100 pt-2">
          {FORECAST.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.day} className="flex flex-col items-center gap-1">
                <p className="text-[10px] text-zinc-500">{f.day}</p>
                <Icon className="h-3.5 w-3.5 text-zinc-400" />
                <p className="text-xs font-semibold text-zinc-800">{f.high}°</p>
                <p className="text-[10px] text-zinc-400">{f.low}°</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
