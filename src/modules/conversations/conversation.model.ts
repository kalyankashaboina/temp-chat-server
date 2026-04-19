import type { Types, Document } from 'mongoose';
import { Schema, model } from 'mongoose';

export interface IConversation extends Document {
  type: 'direct' | 'group';

  name?: string;
  avatar?: string;
  createdBy?: Types.ObjectId;
  admins?: Types.ObjectId[];

  participants: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
  unreadCounts?: {
    userId: Types.ObjectId;
    count: number;
  }[];

  // Mute/Archive per user
  mutedBy?: Types.ObjectId[];
  archivedBy?: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
    },

    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    name: {
      type: String,
      trim: true,
    },

    avatar: {
      type: String,
    },

    // 👇 ADD
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    /**
     * Pointer to latest message
     * Used for sidebar preview
     */
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },

    /**
     * Per-user unread count
     */
    unreadCounts: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],

    /**
     * Users who muted this conversation
     */
    mutedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    /**
     * Users who archived this conversation
     */
    archivedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true, // 👈 you NEED updatedAt
  }
);

/**
 * Indexes
 */
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
