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


//All routes related to matching between users
//All routes require authetication

const router = Router();

//send a match request to a post
router.post("/request", requireAuth, requestMatch);

//accept a match request ( post owner only)
router.put("/:id/accept", requireAuth, acceptMatch);

//decline a match request (post owner only)
router.put("/:id/decline",requireAuth, declineMatch);

//cancel a match request ( requester only)
router.put("/:id/cancel",requireAuth,cancelMatch);

//get all incoming match requests (where i am the post owner)
router.get("/incoming", requireAuth, getIncomingMatches);

//get all outgoing match requests (where i am the requester)
router.get("/outgoing", requireAuth, getOutgoingMatches);

//get all accepted matches ( for chat access)
router.get("/accepted", requireAuth, getAcceptedMatches);

export default router;