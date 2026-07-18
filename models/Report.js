const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema({
    reporterId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    reportedUserid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    disclosedContent: { type: String, required: true},
    reason: {type: String, required: true, trim: true},
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'actioned', 'dismissed'],
        default: 'pending'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true})

module.exports = mongoose.model('Report', reportSchema)