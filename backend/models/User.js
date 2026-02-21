const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    picture: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: ['salesman', 'admin'],
      default: 'admin',
      index: true,
    },
    hierarchy: {
      type: String,
      enum: ['mainteam', 'team', 'subteam', 'salesperson'],
      default: 'salesperson',
      index: true,
    },
    mainTeam: {
      type: String,
      default: 'Unassigned',
      trim: true,
      index: true,
    },
    team: {
      type: String,
      default: 'Unassigned',
      trim: true,
      index: true,
    },
    subTeam: {
      type: String,
      default: 'Unassigned',
      trim: true,
      index: true,
    },
    preferences: {
      adminInsights: {
        collapsedSectionIds: {
          type: [String],
          default: undefined,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
