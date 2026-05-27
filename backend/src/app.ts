import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { unsendMessage } from "./controllers/messages.controller";
import { supabaseAdmin } from "./lib/supabaseAdmin";
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
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
console.log("Messages routes registered")
app.patch("/api/messages/:matchId/read", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const { matchId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .neq("sender_id", userId) // only mark opponent's messages as read
    .is("read_at", null)
    .select("id");

  if (error) return res.status(500).json({ message: error.message });

  return res.json({
    messageIds: data.map((m: any) => m.id),
    readAt: new Date().toISOString()
  });
});
app.patch("/api/messages/:messageId/reaction", requireAuth, async (req: any, res: any) => {
  const { messageId } = req.params;
  const { reaction } = req.body;
  const userId = req.user.id;

  try {
    // Verify the message exists and user is part of the match
    const { data: message, error: msgError } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, match_id")
      .eq("id", messageId)
      .maybeSingle();

    if (msgError || !message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Update reaction in DB
    const { data, error } = await supabaseAdmin
      .from("messages")
      .update({ reaction: reaction || null })
      .eq("id", messageId)
      .select()
      .single();

    if (error) throw error;

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});
app.use("/api/reviews", reviewsRoutes);


app.use(errorHandler);
console.log("Registering messages routes...");
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

export { app };
