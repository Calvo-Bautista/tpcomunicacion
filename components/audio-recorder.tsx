"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { FrequencySpectrum } from "@/components/frequency-spectrum"
import { AudioComparison } from "@/components/audio-comparison"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Mic, Square, Upload, Download, Play, Pause } from "lucide-react"

export const AudioRecorder = () => {
  // State for recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<AudioBuffer | null>(null)
  const [processedAudio, setProcessedAudio] = useState<AudioBuffer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // Audio processing settings
  const [sampleRate, setSampleRate] = useState("44100")
  const [bitDepth, setBitDepth] = useState("16")

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const processedSourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new AudioContext()
    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  // Handle recording start/stop
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        await processAudioBlob(audioBlob)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      // Stop all tracks on the stream
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
    }
  }

  // Process audio blob
  const processAudioBlob = async (blob: Blob) => {
    if (!audioContextRef.current) return

    try {
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      setRecordedAudio(audioBuffer)

      // Process with selected settings
      processAudio(audioBuffer)
    } catch (error) {
      console.error("Error processing audio:", error)
    }
  }

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !audioContextRef.current) return

    setUploadedFile(file)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      setRecordedAudio(audioBuffer)

      // Process with selected settings
      processAudio(audioBuffer)
    } catch (error) {
      console.error("Error loading audio file:", error)
    }
  }

  // Process audio with selected settings
  const processAudio = async (audioBuffer: AudioBuffer) => {
    if (!audioContextRef.current) return

    const targetSampleRate = Number.parseInt(sampleRate)
    const targetBitDepth = Number.parseInt(bitDepth)

    // Create offline context with target sample rate
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.duration * targetSampleRate,
      targetSampleRate,
    )

    // Create buffer source
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)

    // Start rendering
    source.start(0)
    const renderedBuffer = await offlineContext.startRendering()

    // Apply bit depth reduction (quantization)
    const processedBuffer = applyBitDepthReduction(renderedBuffer, targetBitDepth)
    setProcessedAudio(processedBuffer)
  }

  // Apply bit depth reduction
  const applyBitDepthReduction = (buffer: AudioBuffer, bitDepth: number): AudioBuffer => {
    const numChannels = buffer.numberOfChannels
    const length = buffer.length
    const sampleRate = buffer.sampleRate
    const ctx = audioContextRef.current

    if (!ctx) return buffer

    const newBuffer = ctx.createBuffer(numChannels, length, sampleRate)

    // Calculate the quantization step based on bit depth
    const maxValue = Math.pow(2, bitDepth - 1) - 1

    for (let channel = 0; channel < numChannels; channel++) {
      const inputData = buffer.getChannelData(channel)
      const outputData = newBuffer.getChannelData(channel)

      for (let i = 0; i < length; i++) {
        // Scale to the range of the bit depth
        const scaled = Math.round(inputData[i] * maxValue)
        // Quantize by rounding and scale back
        outputData[i] = scaled / maxValue
      }
    }

    return newBuffer
  }

  // Play/pause audio
  const togglePlayback = (type: "original" | "processed") => {
    if (isPlaying) {
      stopPlayback()
    } else {
      playAudio(type)
    }
  }

  const playAudio = (type: "original" | "processed") => {
    if (!audioContextRef.current) return

    stopPlayback() // Stop any current playback

    const buffer = type === "original" ? recordedAudio : processedAudio
    if (!buffer) return

    const source = audioContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(audioContextRef.current.destination)
    source.onended = () => setIsPlaying(false)
    source.start()

    if (type === "original") {
      sourceNodeRef.current = source
    } else {
      processedSourceNodeRef.current = source
    }

    setIsPlaying(true)
  }

  const stopPlayback = () => {
    sourceNodeRef.current?.stop()
    processedSourceNodeRef.current?.stop()
    sourceNodeRef.current = null
    processedSourceNodeRef.current = null
    setIsPlaying(false)
  }

  // Export audio
  const exportAudio = (type: "original" | "processed", format: "wav" | "mp3") => {
    const buffer = type === "original" ? recordedAudio : processedAudio
    if (!buffer) return

    // Convert AudioBuffer to WAV
    const wavBlob = audioBufferToWav(buffer)

    // Create download link
    const url = URL.createObjectURL(wavBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audio-${type}-${sampleRate}hz-${bitDepth}bit.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels
    const length = buffer.length
    const sampleRate = buffer.sampleRate
    const bitsPerSample = Number.parseInt(bitDepth)
    const bytesPerSample = bitsPerSample / 8
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = length * numChannels * bytesPerSample

    const arrayBuffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(arrayBuffer)

    // RIFF chunk descriptor
    writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + dataSize, true)
    writeString(view, 8, "WAVE")

    // FMT sub-chunk
    writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true) // subchunk1size
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)

    // Data sub-chunk
    writeString(view, 36, "data")
    view.setUint32(40, dataSize, true)

    // Write the PCM samples
    const dataView = new DataView(arrayBuffer)
    let offset = 44

    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i]

        // Convert float to int
        let value
        if (bitsPerSample === 8) {
          value = sample * 127 + 128 // 8-bit is unsigned
          dataView.setUint8(offset, value)
          offset += 1
        } else if (bitsPerSample === 16) {
          value = sample * 32767
          dataView.setInt16(offset, value, true)
          offset += 2
        } else if (bitsPerSample === 24) {
          value = sample * 8388607
          const b1 = value & 0xff
          const b2 = (value >> 8) & 0xff
          const b3 = (value >> 16) & 0xff
          dataView.setUint8(offset, b1)
          dataView.setUint8(offset + 1, b2)
          dataView.setUint8(offset + 2, b3)
          offset += 3
        }
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" })
  }

  // Helper function to write strings to DataView
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // Calculate file size
  const calculateFileSize = (buffer: AudioBuffer | null, bitDepth: number): string => {
    if (!buffer) return "0 KB"

    const bytesPerSample = bitDepth / 8
    const sizeInBytes = buffer.length * buffer.numberOfChannels * bytesPerSample

    if (sizeInBytes < 1024) {
      return `${sizeInBytes.toFixed(2)} B`
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(2)} KB`
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`
    }
  }

  // Apply settings when they change
  useEffect(() => {
    if (recordedAudio) {
      processAudio(recordedAudio)
    }
  }, [sampleRate, bitDepth])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Button onClick={toggleRecording} variant={isRecording ? "destructive" : "default"} className="flex-1">
          {isRecording ? (
            <>
              <Square className="mr-2 h-4 w-4" /> Stop Recording
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" /> Start Recording
            </>
          )}
        </Button>

        <div className="flex-1">
          <Input type="file" accept="audio/*" onChange={handleFileUpload} id="audio-upload" className="hidden" />
          <Label htmlFor="audio-upload" className="w-full">
            <Button variant="outline" className="w-full" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" /> Upload Audio
              </span>
            </Button>
          </Label>
        </div>
      </div>

      {uploadedFile && <div className="text-sm text-muted-foreground">Uploaded: {uploadedFile.name}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Label>Sample Rate</Label>
          <Select value={sampleRate} onValueChange={setSampleRate}>
            <SelectTrigger>
              <SelectValue placeholder="Select sample rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8000">8 kHz</SelectItem>
              <SelectItem value="16000">16 kHz</SelectItem>
              <SelectItem value="44100">44.1 kHz</SelectItem>
              <SelectItem value="48000">48 kHz</SelectItem>
              <SelectItem value="96000">96 kHz</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <Label>Bit Depth</Label>
          <Select value={bitDepth} onValueChange={setBitDepth}>
            <SelectTrigger>
              <SelectValue placeholder="Select bit depth" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8">8 bits</SelectItem>
              <SelectItem value="16">16 bits</SelectItem>
              <SelectItem value="24">24 bits</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {recordedAudio && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Original Audio</h3>
              <AudioVisualizer audioBuffer={recordedAudio} />
              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={() => togglePlayback("original")}>
                  {isPlaying && sourceNodeRef.current ? (
                    <Pause className="h-4 w-4 mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isPlaying && sourceNodeRef.current ? "Pause" : "Play"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {recordedAudio.sampleRate} Hz / {recordedAudio.numberOfChannels} ch / Original size:{" "}
                  {calculateFileSize(recordedAudio, 32)}
                </span>
              </div>
            </div>

            {processedAudio && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Processed Audio ({sampleRate} Hz, {bitDepth} bits)
                </h3>
                <AudioVisualizer audioBuffer={processedAudio} />
                <div className="flex justify-between items-center">
                  <Button variant="outline" size="sm" onClick={() => togglePlayback("processed")}>
                    {isPlaying && processedSourceNodeRef.current ? (
                      <Pause className="h-4 w-4 mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {isPlaying && processedSourceNodeRef.current ? "Pause" : "Play"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {processedAudio.sampleRate} Hz / {processedAudio.numberOfChannels} ch / Size:{" "}
                    {calculateFileSize(processedAudio, Number.parseInt(bitDepth))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Frequency Spectrum Comparison</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {recordedAudio && <FrequencySpectrum audioBuffer={recordedAudio} label="Original" />}
              {processedAudio && (
                <FrequencySpectrum
                  audioBuffer={processedAudio}
                  label={`Processed (${sampleRate} Hz, ${bitDepth} bits)`}
                />
              )}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Export Audio</h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline" onClick={() => exportAudio("original", "wav")} disabled={!recordedAudio}>
                <Download className="mr-2 h-4 w-4" /> Export Original (WAV)
              </Button>
              <Button variant="outline" onClick={() => exportAudio("processed", "wav")} disabled={!processedAudio}>
                <Download className="mr-2 h-4 w-4" /> Export Processed (WAV)
              </Button>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Audio Comparison</h3>
            <AudioComparison
              originalAudio={recordedAudio}
              processedAudio={processedAudio}
              sampleRate={Number.parseInt(sampleRate)}
              bitDepth={Number.parseInt(bitDepth)}
            />
          </div>
        </>
      )}
    </div>
  )
}
