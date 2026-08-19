import mongoose from 'mongoose';

// Defines the layout of documents saved in MongoDB
const messageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true }, // Groups messages by chat session
  role: { type: String, enum: ['user', 'model'], required: true }, // Distinguishes user prompts from AI replies
  content: { type: String, required: true }, // The actual message text
  timestamp: { type: Date, default: Date.now } // Ordering timestamp
});

export default mongoose.model('Message', messageSchema);