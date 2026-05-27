import { match } from "assert/strict";
import { Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

//matches.controller.ts - handles all matching logic
    //send match request, accept or decline request/ get incoming or outgoing requests
    //address is hidden until the match request is accepted

    // POST /api/matches/request - send a match request to Post owner
export async function requestMatch(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { post_id } = req.body;

    if (!post_id) {
        return res.status(400).json({ message: "Post ID is required." });
    }

    try{
        //Check if post exists and is active
        const { data: post, error : postError} = await supabaseAdmin
            .from("posts")
            .select("*")
            .eq("id", post_id)
            .eq("status", "active")
            .maybeSingle();
        
        if (postError || !post){
            return res.status(404).json({ message: "Post not found or inactive." });
        }

        //Prevent users from requesting their own posts
        if (post.user_id === userId) {
            return res.status(400).json({ message: "Cannot send request to your own post." });
        }

        //Check if a request is already sent to this post
        const { data: existing } = await supabaseAdmin
            .from("matches")
            .select("*")
            .eq("post_id", post_id)
            .eq("requester_id", userId)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ message: "You have already sent a request to this post." });
        }

        //Create match request with pending status
        const { data, error : matchError} = await supabaseAdmin
            .from("matches")
            .insert({
                post_id,
                requester_id: userId,
                owner_id: post.user_id,
                status: "pending",
            })
            .select("*")
            .single();

            if (matchError) throw matchError;

            return res.status(201).json(match);
    } catch (error) {
        return res.status(500).json({ message: "Failed to send match request." });
    }
}

//PUT /api/matches/:id/accept 
    //Post owner accepts a match request and after that full address will be revealed 

export async function acceptMatch(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;
    try{
        //Only post owner can accept the request
        const { data: match, error: matchError } = await supabaseAdmin
            .from("matches")
            .select("*, posts(full_address,district)")
            .eq("id", id)
            .eq("owner_id", userId)    // Security :: only owner can accept
            .eq("status", "pending")    //Can only accept pending requests
            .maybeSingle();

        if (matchError || !match) {
            return res.status(404).json({ message: "Match request not found or already processed." });
        }

        //Update status to accepted
        const { data: updated, error: updateError } = await supabaseAdmin
            .from("matches")
            .update({ status: "accepted" })
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) throw updateError;
        
        //return match with full address revealed
        return res.json({ 
            ...updated,
            full_address: match.posts?.full_address, //address revealed after match

        });

    }catch (err: any){
        return res.status(500).json({ message: err.message || "Failed to accept match request." });
    }
}
//PUT /api/matches/:id/decline
    //Post owner declines a match request and the request will be deleted from the database
export async function declineMatch(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;
    try{
        //Only post owner can decline the request
        const { data: match, error: matchError } = await supabaseAdmin
            .from("matches")
            .select("*")
            .eq("id", id)
            .eq("owner_id", userId)    // Security :: only owner can decline
            .eq("status", "pending")    //Can only decline pending requests
            .maybeSingle();

        if (matchError || !match) {
            return res.status(404).json({ message: "Match request not found or already processed." });
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from("matches")
            .update({ status: "declined" })
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) throw updateError;

        return res.json(updated);
    }catch (err: any){
        return res.status(500).json({ message: err.message || "Failed to decline match request." });
    }

    }

    //PUT /api/matches/:id/cancel
    //Requester cancels a match request and the request will be deleted from the database
    export async function cancelMatch(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;
    try{
        //Only requester can cancel the request
        const { data: match, error: matchError } = await supabaseAdmin
            .from("matches")
            .select("id")
            .eq("id", id)
            .eq("requester_id", userId)    // Security :: only requester can cancel
            .eq("status", "pending")    //Can only cancel pending requests
            .maybeSingle();

        if (matchError || !match) {
            return res.status(404).json({ message: "Match request not found or cannot be cancelled." });
        }

        //Delete the match request
        const { data: updated , error : updateError } = await supabaseAdmin
            .from("matches")
            .update({status: "cancelled"})
            .eq("id", id)
            .select("*")
            .single();
        if (updateError) throw updateError;

        return res.json(updated);
    }catch (err: any){
        return res.status(500).json({ message: err.message || "Failed to cancel match request." });
    }
    }
//GET /api/matches/incoming 
    //Get incoming match requests for the current user (post owner)
export async function getIncomingMatches( req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;

    try{
        const { data, error } = await supabaseAdmin
            .from("matches")
            .select(`
                *,
                posts(
                    id,
                    post_type,
                    district,
                    monthly_rent,
                    deposit,
                    status
                ),
                requester:users!requester_id(
                    id,
                    name,
                    profile_photo,
                    university,
                    nationality,
                    is_verified,
                    lifestyle_tags,
                    language_spoken
                )
            `)
            .eq("owner_id", userId)
            .order("created_at", {ascending: false});

        if (error) throw error;

        return res.json(data);
    }catch (err: any){
        return res.status(500).json({ message: err.message || "Failed to fetch incoming matches." });
    }
    }
//GET /api/matches/outgoing
    //Get outgoing match requests for the current user (requester)
    export async function getOutgoingMatches(req: AuthenticatedRequest, res: Response){
        const userId = req.user!.id;

        try{
            const { data, error } = await supabaseAdmin
                .from("matches")
                .select(`
                    *,
                    posts(
                        id,
                        post_type,
                        district,
                        monthly_rent,
                        deposit,
                        full_address,
                        status
                    ),
                    owner:users!owner_id(
                        id,
                        name,
                        profile_photo,
                        university,
                        nationality,
                        is_verified
                )
            `)
            .eq("requester_id", userId)
            .order("created_at",{ascending: false});

            if (error ) throw error;

            //hide full address for non-accepted matches
            const sanitized = data.map((match : any ) => ({
                ...match,
                posts:{
                //only reveal full address if match is accepted
                full_address: match.status === "accepted"
                    ? match.posts?.full_address
                    : " Adress revealed after match is accepted",
            },
        }));
        return res.json(sanitized);
        }catch (err: any){
            return res.status(500).json({ message: err.message || "Failed to fetch outgoing matches." });
        }
    }

// GET /api/matches/accepted
//Get all accepted matches for the current user (for chat access)
export async function getAcceptedMatches(req: AuthenticatedRequest, res: Response){
    const userId = req.user!.id;

    try{
        const { data, error } = await supabaseAdmin
            .from("matches")
            .select(`
                *,
                posts(
                    id,
                    post_type,
                    district,
                    full_address,
                    monthly_rent,
            ),
            requester: users!requester_id(
                id,
                name,
                profile_photo,
                university,
            ),
            owner: users!owner_id(
                id,
                name,
                profile_photo,
                university,
                )
            `)
            .eq("status", "accepted")
            //Get matches where user is either requester or owner
            .or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return res.json(data);
            }catch (err: any){
                return res.status(500).json({ message: err.message || "Failed to fetch accepted matches." });

        
    }
}

