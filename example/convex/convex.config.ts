import { defineApp } from "convex/server";
import convexYoutubeMetadata from "convex-youtube-metadata/convex.config.js";

const app = defineApp();
app.use(convexYoutubeMetadata);

export default app;
