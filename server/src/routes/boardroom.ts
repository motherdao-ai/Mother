import express from "express";
import BoardroomService from "../services/boardroom.service.js";

const router = express.Router();
const boardroomService = new BoardroomService();

router.get("/protocols/:protocolId/proposals", async (req, res) => {
  try {
    const { protocolId } = req.params;
    const proposals = await boardroomService.fetchProposals(protocolId);
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/proposals/:proposalId", async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposalDetails =
      await boardroomService.fetchProposalDetails(proposalId);
    res.json(proposalDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/discussions/:protocolId", async (req, res) => {
  try {
    const { protocolId } = req.params;
    const topics = await boardroomService.fetchDiscourseTopics(protocolId);
    res.json(topics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
