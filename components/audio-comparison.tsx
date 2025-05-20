"use client"

import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Play, Pause } from "lucide-react"

interface AudioComparisonProps {
  originalAudio: AudioBuffer | null
  processedAudio: AudioBuffer | null
  sampleRate: number
  bitDepth: number
}

export const AudioComparison = ({ originalAudio, processedAudio, sampleRate, bitDepth }: AudioComparisonProps) => {
  const [position, setPosition] = useState(50)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [originalSource, setOriginalSource] = useState<AudioBufferSourceNode | null>(null)
  const [processedSource, setProcessedSource] = useState<AudioBufferSourceNode | null>(null)
  const [originalGain, setOriginalGain] = useState<GainNode | null>(null)
  const [processedGain, setProcessedGain] = useState<GainNode | null>(null)

  // Initialize audio context
  useEffect(() => {
    const ctx = new AudioContext()
    setAudioContext(ctx)

    return () => {
      ctx.close()
    }
  }, [])

  // Update gain nodes when position changes
  useEffect(() => {
    if (!audioContext || !originalGain || !processedGain) return

    // Calculate gain values based on position (0-100)
    const originalGainValue = (100 - position) / 100
    const processedGainValue = position / 100

    originalGain.gain.value = originalGainValue
    processedGain.gain.value = processedGainValue
  }, [position, audioContext, originalGain, processedGain])

  // Toggle playback
  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback()
    } else {
      startPlayback()
    }
  }

  // Start playback
  const startPlayback = () => {
    if (!audioContext || !originalAudio || !processedAudio) return

    // Stop any current playback
    stopPlayback()

    // Create gain nodes
    const origGain = audioContext.createGain()
    const procGain = audioContext.createGain()

    // Set initial gain values
    const originalGainValue = (100 - position) / 100
    const processedGainValue = position / 100

    origGain.gain.value = originalGainValue
    procGain.gain.value = processedGainValue

    // Connect to output
    origGain.connect(audioContext.destination)
    procGain.connect(audioContext.destination)

    // Create source nodes
    const origSource = audioContext.createBufferSource()
    origSource.buffer = originalAudio
    origSource.connect(origGain)

    const procSource = audioContext.createBufferSource()
    procSource.buffer = processedAudio
    procSource.connect(procGain)

    // Start playback
    origSource.start()
    procSource.start()

    // Set state
    setOriginalSource(origSource)
    setProcessedSource(procSource)
    setOriginalGain(origGain)
    setProcessedGain(procGain)
    setIsPlaying(true)

    // Handle playback end
    origSource.onended = () => {
      setIsPlaying(false)
    }
  }

  // Stop playback
  const stopPlayback = () => {
    if (originalSource) {
      originalSource.stop()
      setOriginalSource(null)
    }

    if (processedSource) {
      processedSource.stop()
      setProcessedSource(null)
    }

    setIsPlaying(false)
  }

  if (!originalAudio || !processedAudio) {
    return null
  }

  return (
    <div className="space-y-6 p-4 border rounded-lg">
      <div className="text-center">
        <h3 className="text-lg font-medium">A/B Comparison</h3>
        <p className="text-sm text-muted-foreground">Slide to blend between original and processed audio</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm font-medium text-right w-24">Original</div>

        <Slider
          value={[position]}
          min={0}
          max={100}
          step={1}
          onValueChange={(values) => setPosition(values[0])}
          className="flex-1"
        />

        <div className="text-sm font-medium w-24">
          {sampleRate} Hz, {bitDepth} bits
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={togglePlayback} className="w-32">
          {isPlaying ? (
            <>
              <Pause className="mr-2 h-4 w-4" /> Stop
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Compare
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-center">
        <div>
          <div className="font-medium">Original</div>
          <div className="text-muted-foreground">{originalAudio.sampleRate} Hz, 32-bit float</div>
        </div>
        <div>
          <div className="font-medium">Processed</div>
          <div className="text-muted-foreground">
            {processedAudio.sampleRate} Hz, {bitDepth}-bit
          </div>
        </div>
      </div>
    </div>
  )
}
