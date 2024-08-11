const Session = require('../models/sessionModel');
const axios = require('axios');

const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models/SeaLLMs/SeaLLMs-v3-1.5B ';
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

// Function to get bot response from Hugging Face API
const getBotResponse = async (message) => {
  try {
    const response = await axios.post(
      HUGGING_FACE_API_URL,
      { inputs: message },
      {
        headers: {
          Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data[0]?.generated_text || 'ขออภัย ไม่สามารถตอบกลับได้ในขณะนี้';
  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    return 'ขออภัย ไม่สามารถตอบกลับได้ในขณะนี้';
  }
};

// Handle chat messages
exports.handleChatMessage = async (req, res) => {
  const { message, sessionId } = req.body;
  const userId = req.user.id; // Get user ID from the authenticated request

  const fewShotExamples = {
    "สวัสดี": "สวัสดีครับ! มีอะไรให้ช่วยครับ?",
    "วันนี้อากาศเป็นอย่างไร": "ผมไม่สามารถบอกอากาศได้ในตอนนี้ แต่ผมสามารถช่วยคุณได้ในเรื่องอื่นครับ",
    "คุณทำอะไรได้": "ผมคือบอทที่ช่วยตอบคำถามเกี่ยวกับ กพอ. ครับ"
  };

  let botResponse;

  try {
    // เช็คว่าข้อความที่รับมาตรงกับตัวอย่างหรือไม่
    if (fewShotExamples[message.trim()]) {
      botResponse = fewShotExamples[message.trim()];
    } else {
      botResponse = await getBotResponse(message);
    }

    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
      session.messages.push({ sender: 'user', text: message }, { sender: 'bot', text: botResponse });
    } else {
      session = new Session({
        userId,
        messages: [{ sender: 'user', text: message }, { sender: 'bot', text: botResponse }],
      });
    }
    await session.save();
    res.json({ reply: botResponse, sessionId: session._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get chat history
exports.getChatHistory = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id }); // Only get sessions for the authenticated user
    res.json(sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete chat session
exports.deleteChatSession = async (req, res) => {
  try {
    await Session.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Update chat session name
exports.updateSessionName = async (req, res) => {
  try {
    const { name } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    session.name = name;
    await session.save();
    res.sendStatus(200);
  } catch (error) {
    console.error('Error updating session name:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
