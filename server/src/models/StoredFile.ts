import { type HydratedDocument, Schema, type Types, model } from 'mongoose';

// Kunci AES file yang dibungkus RSA-OAEP untuk satu user. Selalu ada entri pemilik;
// entri lain adalah penerima share.
export interface WrappedFileKey {
  userId: Types.ObjectId;
  wrappedKey: string; // base64url
  sharedAt: Date;
}

export interface FileSignature {
  value: string; // base64url
  signerId: Types.ObjectId;
  keyFingerprint: string;
  signedAt: Date;
}

export interface FileAttributes {
  ownerId: Types.ObjectId;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  iv: string; // hex
  authTag: string; // hex
  plaintextHash: string; // hex
  wrappedKeys: WrappedFileKey[];
  signature?: FileSignature | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FileDocument = HydratedDocument<FileAttributes>;

const wrappedFileKeySchema = new Schema<WrappedFileKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    wrappedKey: { type: String, required: true },
    sharedAt: { type: Date, required: true },
  },
  { _id: false },
);

const signatureSchema = new Schema<FileSignature>(
  {
    value: { type: String, required: true },
    signerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    keyFingerprint: { type: String, required: true },
    signedAt: { type: Date, required: true },
  },
  { _id: false },
);

const fileSchema = new Schema<FileAttributes>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true, unique: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    plaintextHash: { type: String, required: true },
    wrappedKeys: { type: [wrappedFileKeySchema], required: true },
    signature: { type: signatureSchema, default: null },
  },
  { timestamps: true },
);

fileSchema.index({ 'wrappedKeys.userId': 1 });

export const StoredFile = model<FileAttributes>('File', fileSchema);
