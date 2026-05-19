import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { unsendMessage } from "./controllers/messages.controller";
import { requireAuth } from "./middleware/auth.middleware";
import { errorHandler } from "./middleware/error.middleware";
import authRoutes from "./routes/auth.routes";
import matchesRoutes from "./routes/matches.routes";
import messagesRoutes from "./routes/messages.routes";
import postsRoutes from "./routes/posts.routes";
import profileRoutes from "./routes/profile.routes";
import reviewsRoutes from "./routes/reviews.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS — must be first before everything ──
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──
app.get("/", (req, res) => {
  res.json({ message: "RoomieKorea API is running! 🏠" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", profileRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/matches", matchesRoutes);
app.delete("/api/messages/:messageId",requireAuth,
  (req, res, next) => {
  console.log("🔴 Direct DELETE hit!", req.params.messageId);
  next();
},unsendMessage);

app.use("/api/messages", messagesRoutes);
app.use("/api/messages", messagesRoutes);
console.log("Messages routes registered")
app.use("/api/reviews", reviewsRoutes);


app.use(errorHandler);
console.log("Registering messages routes...");
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

export { app };
