"use client"

import { useState } from "react"
import { AuthPanel } from "@/components/auth-panel"
import { TrafficDashboard } from "@/components/traffic-dashboard"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)

  const handleAuthChange = (authenticated, role) => {
    setIsAuthenticated(authenticated)
    setUserRole(role)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Traffic Signal Management</h1>
          <AuthPanel onAuthChange={handleAuthChange} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isAuthenticated ? (
          <TrafficDashboard userRole={userRole} />
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Please login to access the traffic management system</h2>
              <p className="text-muted-foreground">Use the login panel in the top right corner to get started.</p>
            </div>
          </div>
        )}
      </main>

      <Toaster />
    </div>
  )
}
