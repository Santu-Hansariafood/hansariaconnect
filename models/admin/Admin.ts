import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";

export interface IAdmin extends Document {
  userId: string;
  email: string;
  password: string;
  isSuperAdmin: boolean;
  companyName?: string;
  companyDomain?: string;
  companyVerificationRequested: boolean;
  isCompanyVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AdminSchema = new Schema<IAdmin>(
  {
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: false },
    companyName: { type: String, trim: true, maxlength: 100 },
    companyDomain: { type: String, trim: true, lowercase: true, maxlength: 253 },
    companyVerificationRequested: { type: Boolean, default: false },
    isCompanyVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password before saving
AdminSchema.pre("save", async function (this: IAdmin) {
  if (!this.isModified("password")) return;

  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(this.password)) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
AdminSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.models.Admin || mongoose.model<IAdmin>("Admin", AdminSchema);
