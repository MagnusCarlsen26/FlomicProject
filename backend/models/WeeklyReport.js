const mongoose = require('mongoose');

const planningRowSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    isoWeek: {
      type: Number,
      required: true,
      min: 1,
      max: 53,
    },
    customerName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    locationArea: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    customerType: {
      type: String,
      enum: ['', 'targeted_budgeted', 'existing'],
      default: '',
    },
    contactType: {
      type: String,
      enum: ['', 'nc', 'fc', 'sc', 'jsv'],
      default: '',
    },
    jsvWithWhom: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false }
);

const actualOutputRowSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    isoWeek: {
      type: Number,
      required: true,
      min: 1,
      max: 53,
    },
    visited: {
      type: String,
      enum: ['', 'yes', 'no'],
      default: '',
    },
    notVisitedReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    enquiriesReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    shipmentsConverted: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const weeklyReportSchema = new mongoose.Schema(
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
    weekStartDateUtc: {
      type: Date,
      required: true,
    },
    weekEndDateUtc: {
      type: Date,
      required: true,
    },
    planningRows: {
      type: [planningRowSchema],
      default: [],
    },
    actualOutputRows: {
      type: [actualOutputRowSchema],
      default: [],
    },
    planningSubmittedAt: {
      type: Date,
      default: null,
    },
    actualOutputUpdatedAt: {
      type: Date,
      default: null,
    },
    currentStatus: {
      type: String,
      enum: ['not_started', 'in_progress', 'blocked', 'completed'],
      default: 'not_started',
      index: true,
    },
    statusNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    statusUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

weeklyReportSchema.index({ salesmanId: 1, weekKey: 1 }, { unique: true });

module.exports = mongoose.models.WeeklyReport || mongoose.model('WeeklyReport', weeklyReportSchema);
