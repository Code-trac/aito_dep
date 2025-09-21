"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { getAuthHeaders } from "@/lib/auth"

export function UserControls({ userRole }) {
  const [mockMode, setMockMode] = useState(true)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleMockModeToggle = async (checked) => {
    setLoading(true)
    try {
      const response = await fetch("/api/set_mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ mock: checked }),
      })

      const data = await response.json()
      if (response.ok) {
        setMockMode(data.mock)
        toast({
          title: "Mode updated",
          description: `Switched to ${data.mock ? "mock" : "camera"} mode`,
        })
      } else {
        throw new Error(data.error || "Failed to update mode")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePedestrianRequest = async (lane) => {
    try {
      const response = await fetch("/api/pedestrian", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ lane }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Pedestrian request sent",
          description: `Request for lane ${lane + 1} submitted`,
        })
      } else {
        throw new Error(data.error || "Failed to send request")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleEmergency = async (on, lane = 0) => {
    try {
      const response = await fetch("/api/emergency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ on, lane }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: on ? "Emergency activated" : "Emergency cleared",
          description: on ? `Emergency mode for lane ${data.lane + 1}` : "Normal operation resumed",
          variant: on ? "destructive" : "default",
        })
      } else {
        throw new Error(data.error || "Failed to toggle emergency")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* System Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">System Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Mock Mode</span>
            <Switch checked={mockMode} onCheckedChange={handleMockModeToggle} disabled={loading} />
          </div>
        </CardContent>
      </Card>

      {/* Pedestrian Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pedestrian Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((lane) => (
              <Button
                key={lane}
                variant="outline"
                size="sm"
                onClick={() => handlePedestrianRequest(lane)}
                className="text-xs"
              >
                Lane {lane + 1}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Controls (Officials only) */}
      {userRole === "official" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Emergency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="destructive" size="sm" className="w-full" onClick={() => handleEmergency(true, 0)}>
              Activate Emergency
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent"
              onClick={() => handleEmergency(false)}
            >
              Clear Emergency
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
