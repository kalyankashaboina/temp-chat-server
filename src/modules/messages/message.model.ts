import { Schema, model, Types } from 'mongoose';

const ReactionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, maxlength: 10 },
    username: { type: String, required: true },
  },
  { _id: false }
);

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'text'],
      default: 'document',
    },
  },
  { _id: false }
);

const ReplyToSchema = new Schema(
  {
    messageId: { type: Types.ObjectId, required: true },
    content: { type: String, required: true },
    senderName: { type: String, required: true },
  },
  { _id: false }
);

const MessageSchema = new Schema(
  {
    conversationId: { type: Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    type: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
    attachments: [AttachmentSchema],
    reactions: [ReactionSchema],
    replyTo: { type: ReplyToSchema, default: undefined },
    deliveredTo: [{ type: Types.ObjectId, ref: 'User' }],
    readBy: [{ type: Types.ObjectId, ref: 'User' }],
    starredBy: [{ type: Types.ObjectId, ref: 'User' }],
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    isScheduled: { type: Boolean, default: false },
    scheduledAt: { type: Date },
    forwardedFrom: { type: String },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
// Text index for message search
MessageSchema.index({ content: 'text' });
// Compound index for filtering searches by conversation
MessageSchema.index({ conversationId: 1, content: 'text' });

export const Message = model('Message', MessageSchema);
