"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getAuthHeaders } from "@/lib/auth"

export function EmergencyModal({ userRole }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLane, setSelectedLane] = useState("0")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleEmergencyActivate = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/emergency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          on: true,
          lane: Number.parseInt(selectedLane),
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Emergency Activated",
          description: `Emergency mode activated for lane ${data.lane + 1}`,
          variant: "destructive",
        })
        setIsOpen(false)
      } else {
        throw new Error(data.error || "Failed to activate emergency")
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

  if (userRole !== "official") {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <AlertTriangle className="h-4 w-4" />
          Emergency
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Emergency Override
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will immediately override the traffic system and give priority to the selected lane. Use only in
            genuine emergency situations.
          </p>

          <div>
            <label className="text-sm font-medium">Emergency Lane</label>
            <Select value={selectedLane} onValueChange={setSelectedLane}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Lane 1 (North)</SelectItem>
                <SelectItem value="1">Lane 2 (East)</SelectItem>
                <SelectItem value="2">Lane 3 (South)</SelectItem>
                <SelectItem value="3">Lane 4 (West)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEmergencyActivate} disabled={loading} className="flex-1">
              {loading ? "Activating..." : "Activate Emergency"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
