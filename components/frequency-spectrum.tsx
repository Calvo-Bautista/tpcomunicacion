"use client"

import { useRef, useEffect } from "react"

interface FrequencySpectrumProps {
  audioBuffer: AudioBuffer
  label: string
}

export const FrequencySpectrum = ({ audioBuffer, label }: FrequencySpectrumProps) => {
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

    // Perform FFT
    const fftSize = 2048
    const fft = new FFT(fftSize, audioBuffer.sampleRate)

    // Process audio data in chunks
    const chunkSize = fftSize
    const numChunks = Math.floor(audioData.length / chunkSize)

    // We'll average the frequency data from all chunks
    const averageSpectrum = new Float32Array(fftSize / 2)

    for (let i = 0; i < numChunks; i++) {
      const chunk = audioData.slice(i * chunkSize, (i + 1) * chunkSize)
      const paddedChunk = new Float32Array(fftSize)
      paddedChunk.set(chunk)

      // Apply window function (Hann window)
      for (let j = 0; j < chunkSize; j++) {
        paddedChunk[j] *= 0.5 * (1 - Math.cos((2 * Math.PI * j) / (chunkSize - 1)))
      }

      const spectrum = fft.forward(paddedChunk)

      // Add to average
      for (let j = 0; j < fftSize / 2; j++) {
        averageSpectrum[j] += spectrum[j]
      }
    }

    // Normalize
    for (let i = 0; i < fftSize / 2; i++) {
      averageSpectrum[i] /= numChunks
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw frequency spectrum
    ctx.fillStyle = "#3b82f6"

    const barWidth = canvas.width / (fftSize / 4)
    const maxFreq = audioBuffer.sampleRate / 2

    for (let i = 0; i < fftSize / 4; i++) {
      // Use logarithmic scale for better visualization
      const value = Math.log10(1 + averageSpectrum[i] * 100) / 2
      const barHeight = value * canvas.height

      // Draw bar
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight)
    }

    // Draw frequency labels
    ctx.fillStyle = "#000"
    ctx.font = "12px sans-serif"

    const freqLabels = [100, 1000, 10000]
    freqLabels.forEach((freq) => {
      if (freq < maxFreq) {
        const x = (freq / maxFreq) * canvas.width
        ctx.fillText(`${freq < 1000 ? freq : freq / 1000 + "k"}`, x, canvas.height - 5)
      }
    })

    // Draw label
    ctx.fillStyle = "#000"
    ctx.font = "14px sans-serif"
    ctx.fillText(label, 10, 20)
  }, [audioBuffer, label])

  return (
    <div className="w-full h-48 bg-muted rounded-md overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

// Simple FFT implementation
class FFT {
  size: number
  sampleRate: number

  constructor(size: number, sampleRate: number) {
    this.size = size
    this.sampleRate = sampleRate
  }

  forward(buffer: Float32Array): Float32Array {
    const real = new Float32Array(this.size)
    const imag = new Float32Array(this.size)

    // Copy input to real array
    real.set(buffer)

    // Perform FFT
    this.fft(real, imag)

    // Calculate magnitude
    const magnitude = new Float32Array(this.size / 2)
    for (let i = 0; i < this.size / 2; i++) {
      magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / this.size
    }

    return magnitude
  }

  // Cooley-Tukey FFT algorithm
  fft(real: Float32Array, imag: Float32Array): void {
    const n = real.length

    // Bit reversal
    for (let i = 0; i < n; i++) {
      const j = this.reverseBits(i, Math.log2(n))
      if (j > i) {
        // Swap real
        const tempReal = real[i]
        real[i] = real[j]
        real[j] = tempReal

        // Swap imag
        const tempImag = imag[i]
        imag[i] = imag[j]
        imag[j] = tempImag
      }
    }

    // Butterfly operations
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2
      const angle = (-2 * Math.PI) / size

      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const k = i + j
          const l = i + j + halfSize

          const tReal = real[l] * Math.cos(angle * j) - imag[l] * Math.sin(angle * j)
          const tImag = real[l] * Math.sin(angle * j) + imag[l] * Math.cos(angle * j)

          real[l] = real[k] - tReal
          imag[l] = imag[k] - tImag
          real[k] = real[k] + tReal
          imag[k] = imag[k] + tImag
        }
      }
    }
  }

  // Helper function to reverse bits
  reverseBits(x: number, bits: number): number {
    let result = 0
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (x & 1)
      x >>= 1
    }
    return result
  }
}
