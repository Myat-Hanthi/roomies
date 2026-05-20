import { Router } from "express";
import {
    createPost,
    deletePost,
    getAllPosts,
    getPostById,
    getPostForEdit,
    updatePost,
} from "../controllers/posts.controller";
import { requireAuth } from "../middleware/auth.middleware";

//Handles all post CRUD operations
//Browse is public , create/edit/delete require auth

const router = Router();

//Get All Active posts ( public - no auth needed for browsing )
router.get("/", getAllPosts);

// Fetch the owner's editable post payload, including private fields.
router.get("/:id/edit", requireAuth, getPostForEdit);

//get a single post by id (public)
router.get("/:id", getPostById);

//create a new post (requires auth)
router.post("/", requireAuth, createPost);

//update a post ( requires auth and only owner can update)
router.put("/:id", requireAuth, updatePost);

//delete a post ( requires auth and only owner can delete)
router.delete("/:id", requireAuth, deletePost);

export default router;