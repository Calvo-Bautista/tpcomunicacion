"use client"

import { useRef, useEffect } from "react"

interface AudioVisualizerProps {
  audioBuffer: AudioBuffer
}

export const AudioVisualizer = ({ audioBuffer }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    canvas.width = canvas.clientWidth * window.devicePixelRatio
    canvas.height = canvas.clientHeight * window.devicePixelRatio

    // Get audio data (use first channel)
    const audioData = audioBuffer.getChannelData(0)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set up drawing
    ctx.lineWidth = 2
    ctx.strokeStyle = "#3b82f6"
    ctx.beginPath()

    // Draw waveform
    const sliceWidth = canvas.width / audioData.length
    let x = 0

    for (let i = 0; i < audioData.length; i++) {
      const y = (audioData[i] * 0.5 + 0.5) * canvas.height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.stroke()
  }, [audioBuffer])

  return (
    <div className="w-full h-32 bg-muted rounded-md overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
