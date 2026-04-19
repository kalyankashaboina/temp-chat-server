import type { Document } from 'mongoose';
import { Schema, model, Types } from 'mongoose';

export type AuthProvider = 'local' | 'google';
export type Visibility = 'everyone' | 'contacts' | 'nobody';

export interface IUser extends Document {
  email: string;
  password?: string;
  username: string;
  avatar?: string;
  bio?: string;
  isOnline: boolean;
  provider: AuthProvider;
  googleId?: string;
  isEmailVerified: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: number;
  privacy: {
    lastSeenVisibility: Visibility;
    profilePhotoVisibility: Visibility;
    aboutVisibility: Visibility;
    readReceipts: boolean;
    typingIndicators: boolean;
    onlineStatus: boolean;
  };
  notificationPrefs: {
    pushEnabled: boolean;
    messageNotifications: boolean;
    callNotifications: boolean;
    groupNotifications: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    showPreview: boolean;
  };
  blockedUsers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const PrivacySchema = new Schema(
  {
    lastSeenVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone',
    },
    profilePhotoVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone',
    },
    aboutVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'everyone',
    },
    readReceipts: { type: Boolean, default: true },
    typingIndicators: { type: Boolean, default: true },
    onlineStatus: { type: Boolean, default: true },
  },
  { _id: false }
);

const NotifSchema = new Schema(
  {
    pushEnabled: { type: Boolean, default: true },
    messageNotifications: { type: Boolean, default: true },
    callNotifications: { type: Boolean, default: true },
    groupNotifications: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    vibrationEnabled: { type: Boolean, default: true },
    showPreview: { type: Boolean, default: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false, default: undefined },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 300 },
    isOnline: { type: Boolean, default: false },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, sparse: true },
    isEmailVerified: { type: Boolean, default: false },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Number },
    privacy: { type: PrivacySchema, default: () => ({}) },
    notificationPrefs: { type: NotifSchema, default: () => ({}) },
    blockedUsers: [{ type: Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Indexes are already created by field definitions (email, username, googleId)
// No need for duplicate index definitions

export const User = model<IUser>('User', UserSchema);
