import { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

//handles all post CRUD operations
// full address is hidden until match is accepted

//GET /api/posts
//get all active post with optional filters
export async function getAllPosts(req: Request, res: Response) {
    const { type, district, minRent, maxRent, gender } = req.query;

    try{
        let query = supabaseAdmin
            .from("posts")
            .select(`
                id, post_type, district, monthly_rent, deposit, 
                deposit_negotiable, room_type, furnished,
                available_from, available_until, gender_preference,
                lifestyle_tags, description_en, description_ko,
                photos, status, near_university, created_at,
                users(
                id, name, university, is_verified, profile_photo, nationality)

                `)
            .eq("status", "active")
            .order("created_at", { ascending: false });

        //Apply filters if provided
        if (type)  query = query.eq("post_type", type as string);
        if (district) query = query.eq("district", district as string);
        if (minRent) query = query.gte("monthly_rent", Number(minRent));
        if (maxRent) query = query.lte("monthly_rent", Number(maxRent));
        if (gender) query = query.eq("gender_preference", gender as string);

        const { data, error} = await query;
    
        if (error) throw error;

        //never return full_address in browse - only district
        return res.json(data);
    }catch (error: any) {
        return res.status(400).json({ message: error.message || "Failed to fetch posts." });
        }
    }
//GET /api/posts/:id
//Get a single post - hide full address unless matched
export async function getPostById(req: Request, res: Response) {
    const { id } = req.params;

    try{
        const { data: post, error} = await supabaseAdmin
            .from("posts")
            .select(`
                *,
                users(
                    id, name, university , is_verified,
                    profile_photo, nationality, lifestyle_tags
                )
            `)
            .eq("id", id)
            .single();

        if (error || !post) {
            return res.status(404).json({ message: "Post not found." });
        }
        //to hide full address
        let canViewFullAddress = false;
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.replace("Bearer ", "").trim();
            const {
                data: { user },
                error: authError,
            } = await supabaseAdmin.auth.getUser(token);

            if (!authError && user) {
                if (user.id === post.user_id) {
                    canViewFullAddress = true;
                } else {
                    const { data: acceptedMatch, error: matchError } = await supabaseAdmin
                        .from("matches")
                        .select("id")
                        .eq("post_id", id)
                        .eq("owner_id", post.user_id)
                        .eq("requester_id", user.id)
                        .eq("status", "accepted")
                        .maybeSingle();

                    if (!matchError && acceptedMatch) {
                        canViewFullAddress = true;
                    }
                }
            }
        }

        if (canViewFullAddress) {
            return res.json(post);
        }

        //hide full address by default
        const { full_address, ...safePost } = post;

        return res.json(safePost);
    }catch (error: any) {
        return res.status(500).json({ message: error.message || "Failed to fetch post." });
    }
}
// Return the editable version of a post for its owner only.
export async function getPostForEdit(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;

    try {
        const { data, error } = await supabaseAdmin
            .from("posts")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (error || !data) {
            return res.status(404).json({ message: "Post not found or not authorized." });
        }

        return res.json(data);
    } catch (error: any) {
        return res.status(500).json({ message: error.message || "Failed to fetch post for editing." });
    }
}
// POST /api/posts
//create a new post( auth required)
export async function createPost(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const {
        post_type, district, full_address, near_university,
        monthly_rent, deposit, deposit_negotiable, room_type,
        furnished, available_from, available_until,
        gender_preference, lifestyle_tags, description_en, description_ko, photos,
    } = req.body;

    //validate required fields
    if (!post_type || !district || !monthly_rent) {
        return res.status(400).json({ message: "Post type, district and monthly rent are required." });
    }
    try{
        const { data, error } = await supabaseAdmin
            .from("posts")
            .insert({
                user_id: userId,
                post_type, district, full_address, near_university,
                monthly_rent, deposit, deposit_negotiable, room_type,
                furnished, available_from, available_until,
                gender_preference, lifestyle_tags, description_en, description_ko, photos,
                status: "active",
            })
            .select("*")
            .single();

        if (error) throw error;

        return res.status(201).json(data);
        }catch (error: any) {
            return res.status(500).json({ message: error.message || "Failed to create post." });
        }
    }

//PUT /api/posts/:id
//update a post - only owner can update
export async function updatePost(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;
    
    try{
        const { data, error} = await supabaseAdmin
            .from("posts")
            .update({ ...req.body, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("user_id", userId) // ensure only owner can update
            .select("*")
            .single();

        if (error || !data) {
            return res.status(404).json({ message: "Post not found or not authorized." });
        }

        return res.json(data);
    }catch (error: any) {
        return res.status(500).json({ message: error.message || "Failed to update post." });

    }
}

//DELETE /api/posts/:id
//delete a post - only owner can delete
export async function deletePost(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;

    try{
        const { error} = await supabaseAdmin
            .from("posts")
            .delete()
            .eq("id", id)
            .eq("user_id", userId); // ensure only owner can delete
        if (error) throw error;

        return res.json({ message: "Post deleted successfully." });
    }catch (error: any) {
        return res.status(500).json({ message: error.message || "Failed to delete post." });
    } 
}
    