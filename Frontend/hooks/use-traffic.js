"use client"

import { useEffect, useRef, useState } from "react"
import { getAuthHeaders } from "../lib/auth"

export default function useTraffic({ intervalMs = 1000 } = {}) {
  const [latest, setLatest] = useState(null)
  const historyRef = useRef([[], [], [], []]) // last 30 points per lane
  const [running, setRunning] = useState(true)
  const intervalRef = useRef(intervalMs)

  useEffect(() => {
    intervalRef.current = intervalMs
  }, [intervalMs])

  useEffect(() => {
    let mounted = true
    async function fetchOnce() {
      try {
        const res = await fetch("/api/traffic_data", { headers: getAuthHeaders() })
        if (res.status === 401) {
          // let caller handle unauth
          throw { code: 401, message: "unauthenticated" }
        }
        const data = await res.json()
        if (!mounted) return
        // maintain history buffer (counts)
        for (let i = 0; i < 4; i++) {
          const arr = historyRef.current[i]
          arr.push(data.counts ? data.counts[i] : 0)
          if (arr.length > 30) arr.shift()
        }
        setLatest({ data, history: JSON.parse(JSON.stringify(historyRef.current)) })
      } catch (err) {
        if (err && err.code === 401) {
          // bubble up
          setLatest({ error: "unauthenticated" })
        } else {
          setLatest((prev) => ({ ...(prev || {}), error: (err && err.message) || String(err) }))
        }
      }
    }
    fetchOnce()
    let id = null
    function loop() {
      id = setTimeout(async () => {
        if (running) {
          await fetchOnce()
        }
        loop()
      }, intervalRef.current)
    }
    loop()
    return () => {
      mounted = false
      clearTimeout(id)
    }
  }, [running])

  return {
    latest,
    setRunning,
    running,
    setIntervalMs: (ms) => {
      intervalRef.current = ms
    },
  }
}
