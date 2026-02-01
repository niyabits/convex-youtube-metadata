import "./App.css";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const videoId = "dQw4w9WgXcQ"

function VideoDetails() {
  const videos = useQuery(api.youtube.list, {})
  const videoMetadata = useQuery(api.youtube.getVideoMetadata, {
    videoId,
  })


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
        Videos ({videos?.length ?? 0})
      </h4>
      <div>
        <pre style={{ textAlign: "left" }}> {JSON.stringify(videoMetadata, null, 2)}</pre>
      </div>
      <ul style={{ textAlign: "left", listStyle: "none", padding: 0 }}>
        {videos?.map((video: any) => (
          <li
            key={video._id}
            style={{
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem",
              backgroundColor: "rgba(128, 128, 128, 0.1)",
              borderRadius: "4px",
            }}
          >
            <span style={{ flex: 1 }}>{video.title}</span>
          </li>
        ))}
        {videos?.length === 0 && (
          <li
            style={{ color: "rgba(128, 128, 128, 0.8)", fontStyle: "italic" }}
          >
            No videos yet. Be the first to add a video!
          </li>
        )}
      </ul>
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
