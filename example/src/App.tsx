import "./App.css";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";

type VideoMetadata = {
  videoId: string
  title: string
  channel: string
  publishedAt: string
  description: string
  viewCount: string
  likeCount: string
  duration: string
  thumbnails: string
}

const videoId = "dQw4w9WgXcQ"

function VideoDetails() {
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const handleFetchVideo = useAction(api.youtube.fetchVideoMetadata)

  useEffect(() => {
    handleFetchVideo({ videoId }).then(setVideoMetadata)
  }, [videoId])

  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1rem",
        border: "1px solid rgba(128, 128, 128, 0.3)",
        borderRadius: "8px",
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>
        Videos
      </h4>
      <div>
        <pre style={{ textAlign: "left" }}> {JSON.stringify(videoMetadata, null, 2)}</pre>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <h1>Example App</h1>
      <div className="card">
        <VideoDetails />
      </div>
    </>
  );
}

export default App;
