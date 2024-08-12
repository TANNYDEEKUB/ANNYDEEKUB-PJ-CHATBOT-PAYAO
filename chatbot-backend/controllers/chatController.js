const Session = require('../models/sessionModel');
const axios = require('axios');

const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models/SeaLLMs/SeaLLMs-v3-1.5B';
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

// Function to get bot response from Hugging Face API
const getBotResponse = async (message) => {
  try {
    console.log("Sending request to Hugging Face API with message:", message);

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

    console.log("Received response from Hugging Face API:", response.data);

    if (response.data && response.data.length > 0) {
      return response.data[0].generated_text || 'ขออภัย ไม่สามารถตอบกลับได้ในขณะนี้';
    } else {
      console.error("Unexpected response format:", response.data);
      return 'ขออภัย ไม่สามารถตอบกลับได้ในขณะนี้';
    }

  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    return 'ขออภัย ไม่สามารถตอบกลับได้ในขณะนี้';
  }
};

// Handle chat messages
exports.handleChatMessage = async (req, res) => {
  const { message, sessionId } = req.body;
  const userId = req.user ? req.user._id : null;

  console.log("Received sessionId:", sessionId);
  console.log("Current userId:", userId);  // ตรวจสอบว่า userId ถูกต้องหรือไม่

  const fewShotExamples = {
    "สวัสดี": "สวัสดีครับ! มีอะไรให้ช่วยครับ?",
    "วันนี้อากาศเป็นอย่างไร": "ผมไม่สามารถบอกอากาศได้ในตอนนี้ แต่ผมสามารถช่วยคุณได้ในเรื่องอื่นครับ",
    "คุณทำอะไรได้": "ผมคือบอทที่ช่วยตอบคำถามเกี่ยวกับ กพอ. ครับ"
  };

  let botResponse;

  try {
    if (fewShotExamples[message.trim()]) {
      botResponse = fewShotExamples[message.trim()];
    } else {
      botResponse = await getBotResponse(message);
    }

    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      session.messages.push({ sender: 'user', text: message }, { sender: 'bot', text: botResponse });
    } else {
      console.log("Creating new session with userId:", userId); // ตรวจสอบว่ามีการสร้าง session ใหม่พร้อมกับ userId ที่ถูกต้องหรือไม่
      session = new Session({
        userId, // สามารถเป็น null ได้ถ้าผู้ใช้ไม่ได้ล็อกอิน
        messages: [{ sender: 'user', text: message }, { sender: 'bot', text: botResponse }],
      });
    }
    await session.save();

    // อัปเดต session ที่สร้างใหม่เพื่อให้แน่ใจว่าข้อมูลถูกบันทึกอย่างถูกต้อง
    if (!sessionId) {
      const updatedSession = await Session.findById(session._id);
      console.log("After save, session userId is:", updatedSession.userId);
    }

    res.json({ reply: botResponse, sessionId: session._id });

  } catch (error) {
    console.error("Error in handleChatMessage:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


// Get chat history
exports.getChatHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessions = await Session.find({ userId: req.user._id });
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete chat session
exports.deleteChatSession = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await Session.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateSessionName = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name } = req.body;
    console.log("Received name:", name); // ตรวจสอบว่ามีการรับค่า name หรือไม่
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.name = name || 'การสนทนาใหม่'; // กำหนดค่าชื่อ
    await session.save();

    console.log("After save, session name is:", session.name); // ตรวจสอบหลังการบันทึก

    res.sendStatus(200);
  } catch (error) {
    console.error('Error updating session name:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};









