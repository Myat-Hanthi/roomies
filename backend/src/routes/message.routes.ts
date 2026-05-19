import { Router } from "express";
import { getMessages, sendMessage } from "../controllers/messages.controller";
import { requireAuth } from "../middleware/auth.middleware";

console.log("Messages routes loaded ");
//GET /:matchId - fetch all the messages
//POST /:matchId - send a message
//DELETE /:messageId - unsend a message (sender only )
const router = Router();
router.get("/:matchId",requireAuth,getMessages);
router.post("/:matchId",requireAuth,sendMessage);
router.delete("/test/ping", (req, res) => {
    res.json({ message: "DELETE works!" });
});

router.delete("/:messageId",(req,res)=>{
    console.log("Delete hit!",req.params);
    res.json({ok:true, params: req.params});
});

export default router;
