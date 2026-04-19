import type { Types, Document } from 'mongoose';
import { Schema, model } from 'mongoose';

export interface ISession extends Document {
  userId: Types.ObjectId;
  isRevoked: boolean;
  userAgent?: string;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Session = model<ISession>('Session', SessionSchema);
