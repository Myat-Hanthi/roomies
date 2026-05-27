import { Router } from "express";
import {
    acceptMatch,
    cancelMatch,
    declineMatch,
    getAcceptedMatches,
    getIncomingMatches,
    getOutgoingMatches,
    requestMatch,
} from "../controllers/matches.controller";
import { requireAuth } from "../middleware/auth.middleware";

// Match request endpoints between post owners and interested users.

const router = Router();

// Send a new interest request for a post.
router.post("/request", requireAuth, requestMatch);

// Accept a pending match request as the post owner.
router.put("/:id/accept", requireAuth, acceptMatch);

// Decline a pending match request as the post owner.
router.put("/:id/decline",requireAuth, declineMatch);

// Cancel a pending request as the original requester.
router.put("/:id/cancel",requireAuth,cancelMatch);

// List requests sent to the current user's posts.
router.get("/incoming", requireAuth, getIncomingMatches);

// List requests created by the current user.
router.get("/outgoing", requireAuth, getOutgoingMatches);

// List accepted matches for chat and review flows.
router.get("/accepted", requireAuth, getAcceptedMatches);

export default router;