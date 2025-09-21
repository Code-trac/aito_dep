"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

function TrafficLight({ isActive, color }) {
  const colorClasses = {
    red: isActive ? "bg-red-500" : "bg-red-200",
    yellow: isActive ? "bg-yellow-500" : "bg-yellow-200",
    green: isActive ? "bg-green-500" : "bg-green-200",
  }

  return <div className={`w-6 h-6 rounded-full ${colorClasses[color]} border-2 border-gray-300`} />
}

function CountdownRing({ seconds, maxSeconds = 60 }) {
  const percentage = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0
  const circumference = 2 * Math.PI * 20
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative w-16 h-16">
      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" stroke="currentColor" strokeWidth="2" fill="none" className="text-muted" />
        <circle
          cx="22"
          cy="22"
          r="20"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{seconds}</span>
      </div>
    </div>
  )
}

function Sparkline({ data, width = 60, height = 20 }) {
  if (!data || data.length < 2) {
    return <div className={`w-[${width}px] h-[${height}px] bg-muted rounded`} />
  }

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} className="text-primary">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  )
}

function LaneCard({ lane, index, trafficData, history }) {
  const isActive = trafficData?.next_lane === index
  const density = trafficData?.densities?.[index] || 0
  const count = trafficData?.counts?.[index] || 0
  const timer = trafficData?.timers?.[index] || 0
  const signalTimer = isActive ? trafficData?.signal_timer || 0 : 0
  const laneHistory = history?.[index] || []

  return (
    <Card className={`transition-all duration-300 ${isActive ? "ring-2 ring-primary shadow-lg" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Lane {index + 1}</h3>
          <div className="flex flex-col items-center gap-1">
            <TrafficLight isActive={!isActive} color="red" />
            <TrafficLight isActive={false} color="yellow" />
            <TrafficLight isActive={isActive} color="green" />
          </div>
        </div>

        <div className="space-y-3">
          {/* Density Display */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-muted-foreground">Density</span>
              <span className="text-2xl font-bold text-primary">{density.toFixed(1)}%</span>
            </div>
            <Progress value={density} className="h-2" />
          </div>

          {/* Count Display */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Count</span>
            <span className="text-lg font-semibold">{count}</span>
          </div>

          {/* Timer Display */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Timer</span>
            <span className="text-sm">{timer}s</span>
          </div>

          {/* Active Lane Countdown */}
          {isActive && signalTimer > 0 && (
            <div className="flex justify-center pt-2">
              <CountdownRing seconds={signalTimer} maxSeconds={60} />
            </div>
          )}

          {/* Sparkline */}
          <div>
            <span className="text-xs text-muted-foreground">History</span>
            <div className="mt-1">
              <Sparkline data={laneHistory} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function LaneVisualizer({ trafficData, history, userRole }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Traffic Lanes</h2>
        <div className="flex items-center gap-2">
          {trafficData?.mode && (
            <Badge variant="outline" className="capitalize">
              {trafficData.mode}
            </Badge>
          )}
          {trafficData?.next_lane !== undefined && (
            <Badge variant="default">Active: Lane {trafficData.next_lane + 1}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((index) => (
          <LaneCard key={index} lane={index} index={index} trafficData={trafficData} history={history} />
        ))}
      </div>

      {/* System Status */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {trafficData?.densities?.reduce((a, b) => a + b, 0)?.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Total Density</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {trafficData?.counts?.reduce((a, b) => a + b, 0) || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Vehicles</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{trafficData?.signal_timer || 0}s</div>
              <div className="text-sm text-muted-foreground">Signal Timer</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{trafficData?.mode || "Unknown"}</div>
              <div className="text-sm text-muted-foreground">System Mode</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
