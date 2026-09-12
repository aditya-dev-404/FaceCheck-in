import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Person = global identity, decoupled from any single organization.
// Replaces the identity-related fields that used to live on User.
// A Person can hold many Memberships (see Membership.model.js), one per org.
const personSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarPublicId: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    setPasswordToken: {
      type: String,
      default: null,
    },
    setPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: "persons" }
);
personSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

personSchema.methods.isPasswordCorrect = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Access token no longer carries organization — that comes from the
// active Membership chosen at/after login (see auth.service.js).
personSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

personSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

export const Person = mongoose.model("Person", personSchema);