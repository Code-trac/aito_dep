"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { clearToken } from "@/lib/auth"
import useTraffic from "@/hooks/use-traffic"
import { LaneVisualizer } from "@/components/lane-visualizer"
import { OfficialPanel } from "@/components/official-panel"
import { UserControls } from "@/components/user-controls"
import { EmergencyModal } from "@/components/emergency-modal"
import { getAuthHeaders } from "@/lib/auth" // Added import for getAuthHeaders

export function TrafficDashboard({ userRole }) {
  const [intervalMs, setIntervalMs] = useState(1000)
  const { latest, setRunning, running } = useTraffic({ intervalMs })
  const { toast } = useToast()

  // Handle authentication errors
  useEffect(() => {
    if (latest?.error === "unauthenticated") {
      clearToken()
      toast({
        title: "Session expired",
        description: "Please login again.",
        variant: "destructive",
      })
      window.location.reload()
    }
  }, [latest?.error, toast])

  const handleIntervalChange = (value) => {
    const ms = Number.parseInt(value)
    setIntervalMs(ms)
  }

  const togglePolling = () => {
    setRunning(!running)
  }

  const handleEmergencyClear = async () => {
    try {
      const response = await fetch("/api/emergency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ on: false }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Emergency Cleared",
          description: "Normal traffic operation resumed",
        })
      } else {
        throw new Error(data.error || "Failed to clear emergency")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  if (!latest) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Connecting to traffic system...</p>
        </div>
      </div>
    )
  }

  if (latest.error && latest.error !== "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Connection Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Unable to connect to the traffic management backend.</p>
            <p className="text-sm text-muted-foreground">Ensure backend is running on port 5000 and CORS is allowed.</p>
            <Button onClick={() => window.location.reload()} className="w-full mt-4">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const trafficData = latest.data

  return (
    <div className="space-y-6">
      {/* Emergency Banner */}
      {trafficData?.emergency && (
        <div className="bg-destructive text-destructive-foreground p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <div>
                <div className="font-bold text-lg">EMERGENCY MODE ACTIVE</div>
                <div className="text-sm opacity-90">Lane {(trafficData.emergency_lane || 0) + 1} has priority</div>
              </div>
            </div>
            {userRole === "official" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEmergencyClear}
                className="bg-white text-destructive hover:bg-gray-100"
              >
                Clear Emergency
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Polling:</span>
          <Select value={intervalMs.toString()} onValueChange={handleIntervalChange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="500">0.5s</SelectItem>
              <SelectItem value="1000">1s</SelectItem>
              <SelectItem value="2000">2s</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={running ? "default" : "secondary"} size="sm" onClick={togglePolling}>
            {running ? "Pause" : "Resume"}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Mode:</span>
          <Badge variant="outline">{trafficData?.mode || "unknown"}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Last Update:</span>
          <span className="text-sm text-muted-foreground">
            {trafficData?.timestamp ? new Date(trafficData.timestamp * 1000).toLocaleTimeString() : "Never"}
          </span>
        </div>

        <div className="ml-auto">
          <EmergencyModal userRole={userRole} />
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lane Visualizations */}
        <div className="lg:col-span-3">
          <LaneVisualizer trafficData={trafficData} history={latest.history} userRole={userRole} />
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          <UserControls userRole={userRole} />
          {userRole === "official" && <OfficialPanel />}
        </div>
      </div>
    </div>
  )
}
