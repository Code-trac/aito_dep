"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { saveToken, clearToken, getToken, getRole } from "@/lib/auth"

export function AuthPanel({ onAuthChange }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const token = getToken()
    const role = getRole()
    if (token && role) {
      setIsAuthenticated(true)
      setUserRole(role)
      onAuthChange?.(true, role)
    }
  }, [onAuthChange])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/signup"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        if (isLogin) {
          saveToken(data.token, data.role)
          setIsAuthenticated(true)
          setUserRole(data.role)
          onAuthChange?.(true, data.role)
          toast({
            title: "Login successful",
            description: `Welcome back, ${username}!`,
          })
        } else {
          toast({
            title: "Signup successful",
            description: "Please login with your new account.",
          })
          setIsLogin(true)
        }
        setUsername("")
        setPassword("")
      } else {
        toast({
          title: "Authentication failed",
          description: data.error || "Please check your credentials.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Connection error",
        description: "Ensure backend is running on port 5000 and CORS allowed.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearToken()
    setIsAuthenticated(false)
    setUserRole(null)
    onAuthChange?.(false, null)
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    })
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant={userRole === "official" ? "default" : "secondary"}>
          {userRole === "official" ? "Official" : "User"}
        </Badge>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    )
  }

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="text-center">{isLogin ? "Login" : "Sign Up"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processing..." : isLogin ? "Login" : "Sign Up"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Need an account? Sign up" : "Have an account? Login"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
