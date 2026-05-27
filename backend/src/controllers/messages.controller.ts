import { Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

async function getAuthorizedMatch(matchId: string, userId: string) {
    const { data: match, error } = await supabaseAdmin
        .from("matches")
        .select("id, requester_id, owner_id, status")
        .eq("id", matchId)
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return match;
}

function getRouteParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function getAuthorizedMessage(messageId: string, userId: string) {
    const { data: message, error } = await supabaseAdmin
        .from("messages")
        .select("id, sender_id, match_id, read_at, reaction")
        .eq("id", messageId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!message) {
        return { message: null, match: null };
    }

    const match = await getAuthorizedMatch(message.match_id, userId);
    return { message, match };
}


// Handles chat messages between matched users
// Only users who are part of a match can send/receive messages

// GET /api/messages/:matchId
// Get all messages for a specific match
export async function getMessages(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { matchId } = req.params;

    try {
        // Security: verify user is part of this match
        const { data: match, error: matchError } = await supabaseAdmin
            .from("matches")
            .select("id, requester_id, owner_id")
            .eq("id", matchId)
            .or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
            .maybeSingle();

        if (matchError || !match) {
            return res.status(403).json({ message: "Not authorized to view these messages." });
        }

        // Fetch all messages for this match
        const { data, error } = await supabaseAdmin
            .from("messages")
            .select(`
            id, match_id, sender_id, content, created_at, read_at, reaction,
            users!sender_id ( name, profile_photo )
        `)
            .eq("match_id", matchId)
            .order("created_at", { ascending: true });

        if (error) throw error;

        return res.json(data);
    } catch (err: any) {
        return res.status(500).json({ message: err.message || "Failed to fetch messages." });
    }
}

// POST /api/messages/:matchId
// Send a new message to a match
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { matchId } = req.params;
    const { content } = req.body;

    // Validate message content
    if (!content?.trim()) {
        return res.status(400).json({ message: "Message content cannot be empty." });
    }

    try {
        // Security: verify user is part of this match and it's accepted
        const { data: match, error: matchError } = await supabaseAdmin
            .from("matches")
            .select("id, status")
            .eq("id", matchId)
            .eq("status", "accepted")    // Can only chat in accepted matches
            .or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
            .maybeSingle();

        if (matchError || !match) {
            return res.status(403).json({ message: "Not authorized to send messages in this match." });
        }

        // Insert the message
        const { data, error } = await supabaseAdmin
            .from("messages")
            .insert({
                match_id: matchId,
                sender_id: userId,
                content: content.trim(),
            })
            .select()
            .single();

        if (error) throw error;

        // Supabase Realtime will automatically push this to subscribers
        return res.status(201).json(data);
    } catch (err: any) {
        return res.status(500).json({ message: err.message || "Failed to send message." });
    }
}
// PATCH /api/messages/:matchId/read
// Mark all unread incoming messages in one conversation as read
export async function markMessagesAsRead(
    req: AuthenticatedRequest,
    res: Response
) {
    const userId = req.user!.id;
    const matchId = getRouteParam(req.params.matchId);

    try {
        const match = await getAuthorizedMatch(matchId, userId);

        if (!match) {
            return res
                .status(403)
                .json({ message: "Not authorized to update these messages." });
        }

        const readAt = new Date().toISOString();
        const { data, error } = await supabaseAdmin
            .from("messages")
            .update({ read_at: readAt })
            .eq("match_id", matchId)
            .neq("sender_id", userId)
            .is("read_at", null)
            .select("id, match_id, sender_id, read_at");

        if (error) {
            throw error;
        }

        return res.json({
            updatedCount: data.length,
            messageIds: data.map((message) => message.id),
            readAt,
        });
    } catch (err: any) {
        return res
            .status(500)
            .json({ message: err.message || "Failed to mark messages as read." });
    }
}

// PATCH /api/messages/:messageId/reaction
// Toggle the single supported message reaction for a conversation participant
export async function updateMessageReaction(
    req: AuthenticatedRequest,
    res: Response
) {
    const userId = req.user!.id;
    const messageId = getRouteParam(req.params.messageId);
    const rawReaction = req.body?.reaction;

    if (
        rawReaction !== null &&
        rawReaction !== "" &&
        rawReaction !== undefined &&
        rawReaction !== "👍🏻"
    ) {
        return res
            .status(400)
            .json({ message: "Only the thumbs-up reaction is supported." });
    }

    try {
        const { message, match } = await getAuthorizedMessage(messageId, userId);

        if (!message) {
            return res.status(404).json({ message: "Message not found." });
        }

        if (!match) {
            return res
                .status(403)
                .json({ message: "Not authorized to react to this message." });
        }

        const nextReaction = rawReaction === "👍🏻" ? "👍🏻" : null;
        const { data, error } = await supabaseAdmin
            .from("messages")
            .update({ reaction: nextReaction })
            .eq("id", messageId)
            .select("id, match_id, sender_id, content, created_at, read_at, reaction")
            .single();

        if (error) {
            throw error;
        }

        return res.json(data);
    } catch (err: any) {
        return res
            .status(500)
            .json({ message: err.message || "Failed to update message reaction." });
    }
}
//DELETE /api/message/:matchId/:messageId
//unsend - delete message from DB for everyone
//only the original sender can unsend
export async function unsendMessage(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { messageId } = req.params;
    console.log("Unsend called:", { messageId, userId });
    try {
        //Check message exists and belongs to this match
        const { data: message, error: msgError } = await supabaseAdmin
            .from("messages")
            .select("id, sender_id, match_id")
            .eq("id", messageId)
            .maybeSingle();
        console.log("Message found:", message);
        console.log("Message error:", msgError);
        if (msgError || !message) {
            return res.status(404).json({ message: "Message not found." });
        }
        //only sender can unsend their own message
        if (message.sender_id !== userId) {
            return res.status(403).json({ message: " You can only unsend your own message." });

        }


        //delete from db, supabase realtime fires DELETE event to all subscribers
        const { error: deleteError } = await supabaseAdmin
            .from("messages")
            .delete()
            .eq("id", messageId);

        if (deleteError) throw deleteError;
        return res.json({ message: "Message unsent successfully.", id: messageId });

    } catch (err: any) {
        return res.status(500).json({ message: err.message || "Failed to unsend message." });
    }
}
