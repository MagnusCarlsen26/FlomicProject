const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'ignored'],
      required: true,
    },
    toStatus: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'ignored'],
      required: true,
    },
    changedBy: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const exceptionCaseSchema = new mongoose.Schema(
  {
    caseKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 500,
    },
    ruleId: {
      type: String,
      enum: ['EX-01', 'EX-02', 'EX-03', 'EX-04'],
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    normalizedCustomer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    salesmanId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    salesmanName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    team: {
      type: String,
      default: 'Unassigned',
      trim: true,
      maxlength: 200,
      index: true,
    },
    adminOwnerId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
      index: true,
    },
    firstSeenDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    latestSeenDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'ignored'],
      default: 'open',
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastComputedAt: {
      type: Date,
      default: null,
    },
    metrics: {
      visitedCount: { type: Number, default: 0, min: 0 },
      enquiryCount: { type: Number, default: 0, min: 0 },
      shipmentCount: { type: Number, default: 0, min: 0 },
      jsvCount: { type: Number, default: 0, min: 0 },
      followupVisitCount: { type: Number, default: 0, min: 0 },
    },
    timeline: {
      type: [
        {
          _id: false,
          date: {
            type: String,
            match: /^\d{4}-\d{2}-\d{2}$/,
            required: true,
          },
          contactType: {
            type: String,
            default: '',
            trim: true,
          },
          visited: {
            type: Boolean,
            default: false,
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
      ],
      default: [],
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

exceptionCaseSchema.index({ ruleId: 1, status: 1, active: 1 });
exceptionCaseSchema.index({ salesmanId: 1, status: 1, active: 1 });
exceptionCaseSchema.index({ team: 1, status: 1, active: 1 });

module.exports = mongoose.models.ExceptionCase || mongoose.model('ExceptionCase', exceptionCaseSchema);
