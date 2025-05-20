import { AudioRecorder } from "@/components/audio-recorder"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold text-center mb-8">Audio Digitization Lab</h1>
      <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
        Record audio and analyze how different sampling rates and bit depths affect quality and file size
      </p>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Audio Recorder</CardTitle>
            <CardDescription>Record audio from your microphone or upload an existing file</CardDescription>
          </CardHeader>
          <CardContent>
            <AudioRecorder />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
