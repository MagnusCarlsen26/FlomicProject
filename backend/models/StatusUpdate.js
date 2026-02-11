const mongoose = require('mongoose');

const statusUpdateSchema = new mongoose.Schema(
  {
    salesmanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    weekKey: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'blocked', 'completed'],
      required: true,
      index: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.StatusUpdate || mongoose.model('StatusUpdate', statusUpdateSchema);
