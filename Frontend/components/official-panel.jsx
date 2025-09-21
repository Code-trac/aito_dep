"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getAuthHeaders } from "@/lib/auth"

function PredictionChart({ data }) {
  if (!data || !data.x || !data.pdf) {
    return <div className="text-sm text-muted-foreground">No prediction data</div>
  }

  const maxPdf = Math.max(...data.pdf)
  const maxCdf = Math.max(...data.cdf)

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Probability Density (PDF)</h4>
        <svg width="200" height="60" className="border rounded">
          <polyline
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            points={data.x
              .map((x, i) => `${(i / (data.x.length - 1)) * 200},${60 - (data.pdf[i] / maxPdf) * 50}`)
              .join(" ")}
          />
        </svg>
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Cumulative Distribution (CDF)</h4>
        <svg width="200" height="60" className="border rounded">
          <polyline
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="2"
            points={data.x
              .map((x, i) => `${(i / (data.x.length - 1)) * 200},${60 - (data.cdf[i] / maxCdf) * 50}`)
              .join(" ")}
          />
        </svg>
      </div>
      <div className="text-xs text-muted-foreground">
        μ = {data.mu?.toFixed(2)}, σ = {data.sigma?.toFixed(2)}
      </div>
    </div>
  )
}

export function OfficialPanel() {
  const [takeoverLane, setTakeoverLane] = useState("0")
  const [takeoverDuration, setTakeoverDuration] = useState("30")
  const [trainIterations, setTrainIterations] = useState("1000")
  const [alerts, setAlerts] = useState([])
  const [agentStats, setAgentStats] = useState(null)
  const [predictionLane, setPredictionLane] = useState("0")
  const [predictionData, setPredictionData] = useState(null)
  const [cameraPreview, setCameraPreview] = useState(null)
  const [loading, setLoading] = useState({})
  const { toast } = useToast()

  // Load alerts on mount
  useEffect(() => {
    loadAlerts()
    loadAgentStats()
  }, [])

  const setLoadingState = (key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }))
  }

  const loadAlerts = async () => {
    try {
      const response = await fetch("/alerts", {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setAlerts(data)
      }
    } catch (error) {
      console.error("Failed to load alerts:", error)
    }
  }

  const loadAgentStats = async () => {
    try {
      const response = await fetch("/api/agent_stats", {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setAgentStats(data)
      }
    } catch (error) {
      console.error("Failed to load agent stats:", error)
    }
  }

  const handleTakeover = async () => {
    setLoadingState("takeover", true)
    try {
      const response = await fetch("/official/takeover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          lane: Number.parseInt(takeoverLane),
          duration: Number.parseInt(takeoverDuration),
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Takeover successful",
          description: `Manual control of lane ${data.lane + 1} for ${data.duration}s`,
        })
      } else {
        throw new Error(data.error || "Takeover failed")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingState("takeover", false)
    }
  }

  const handleTrainRL = async () => {
    setLoadingState("train", true)
    try {
      const response = await fetch("/api/train_rl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          iters: Number.parseInt(trainIterations),
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Training completed",
          description: `Trained for ${data.iters} iterations. Buffer size: ${data.buffer_size}`,
        })
        loadAgentStats() // Refresh stats
      } else {
        throw new Error(data.error || "Training failed")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingState("train", false)
    }
  }

  const handleViewLogs = async () => {
    setLoadingState("logs", true)
    try {
      const response = await fetch("/api/logs", {
        headers: getAuthHeaders(),
      })

      const data = await response.json()
      if (response.ok) {
        // Show logs in a simple format
        const logText =
          data.overrides
            ?.map(
              (log) =>
                `${new Date(log.ts * 1000).toLocaleString()}: ${log.user} - Lane ${log.lane + 1} for ${log.duration}s (${log.reason})`,
            )
            .join("\n") || "No logs available"

        alert(`Recent Overrides:\n\n${logText}`)
      } else {
        throw new Error(data.error || "Failed to load logs")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingState("logs", false)
    }
  }

  const handleCameraPreview = async () => {
    setLoadingState("camera", true)
    try {
      const response = await fetch("/camera/preview", {
        headers: getAuthHeaders(),
      })

      const data = await response.json()
      if (response.ok) {
        setCameraPreview(data.url)
      } else {
        throw new Error(data.error || "Failed to load camera preview")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoadingState("camera", false)
    }
  }

  const handleAckAlert = async (lane) => {
    try {
      const response = await fetch("/alerts/ack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ lane }),
      })

      if (response.ok) {
        toast({
          title: "Alert acknowledged",
          description: `Alert for lane ${lane + 1} has been acknowledged`,
        })
        loadAlerts() // Refresh alerts
      } else {
        throw new Error("Failed to acknowledge alert")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleLoadPrediction = async () => {
    setLoadingState("prediction", true)
    try {
      const response = await fetch(`/official/prediction?lane=${predictionLane}`, {
        headers: getAuthHeaders(),
      })

      const data = await response.json()
      if (response.ok) {
        setPredictionData(data)
      } else {
        throw new Error(data.error || "Failed to load prediction")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      setPredictionData(null)
    } finally {
      setLoadingState("prediction", false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Manual Takeover */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Manual Takeover</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Lane</label>
            <Select value={takeoverLane} onValueChange={setTakeoverLane}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Lane 1</SelectItem>
                <SelectItem value="1">Lane 2</SelectItem>
                <SelectItem value="2">Lane 3</SelectItem>
                <SelectItem value="3">Lane 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration (seconds)</label>
            <Input
              type="number"
              value={takeoverDuration}
              onChange={(e) => setTakeoverDuration(e.target.value)}
              min="1"
              max="300"
            />
          </div>
          <Button onClick={handleTakeover} disabled={loading.takeover} className="w-full" size="sm">
            {loading.takeover ? "Taking over..." : "Take Control"}
          </Button>
        </CardContent>
      </Card>

      {/* AI Training */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">AI Training</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Iterations</label>
            <Input
              type="number"
              value={trainIterations}
              onChange={(e) => setTrainIterations(e.target.value)}
              min="100"
              max="10000"
            />
          </div>
          <Button onClick={handleTrainRL} disabled={loading.train} className="w-full" size="sm">
            {loading.train ? "Training..." : "Train RL Agent"}
          </Button>
          {agentStats && (
            <div className="text-xs text-muted-foreground">
              Epsilon: {agentStats.eps?.toFixed(3)}, Buffer: {agentStats.buffer_len}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">System Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={handleViewLogs}
            disabled={loading.logs}
            variant="outline"
            size="sm"
            className="w-full bg-transparent"
          >
            {loading.logs ? "Loading..." : "View Logs"}
          </Button>
          <Button
            onClick={handleCameraPreview}
            disabled={loading.camera}
            variant="outline"
            size="sm"
            className="w-full bg-transparent"
          >
            {loading.camera ? "Loading..." : "Camera Preview"}
          </Button>
        </CardContent>
      </Card>

      {/* Camera Preview */}
      {cameraPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Camera Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <img
              src={cameraPreview || "/placeholder.svg"}
              alt="Traffic camera preview"
              className="w-full rounded border"
              onError={() => setCameraPreview(null)}
            />
          </CardContent>
        </Card>
      )}

      {/* Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Traffic Predictions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={predictionLane} onValueChange={setPredictionLane}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Lane 1</SelectItem>
                <SelectItem value="1">Lane 2</SelectItem>
                <SelectItem value="2">Lane 3</SelectItem>
                <SelectItem value="3">Lane 4</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleLoadPrediction} disabled={loading.prediction} size="sm">
              {loading.prediction ? "..." : "Load"}
            </Button>
          </div>
          <PredictionChart data={predictionData} />
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">System Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active alerts</p>
          ) : (
            <div className="space-y-2">
              {alerts
                .filter((alert) => !alert.ack)
                .map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-destructive/10 rounded">
                    <div>
                      <div className="text-sm font-medium">Lane {alert.lane + 1}</div>
                      <div className="text-xs text-muted-foreground">{alert.msg}</div>
                    </div>
                    <Button onClick={() => handleAckAlert(alert.lane)} size="sm" variant="outline">
                      ACK
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
