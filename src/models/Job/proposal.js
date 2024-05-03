const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const proposalSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    job: {
        type: Schema.Types.ObjectId,
        ref: 'job',
        required: true
    },
    coverLetter: {
        type: String,
        required: true
    },
    budget: {
        type: Number,
        required: true
    },
    acknowledged: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Proposal = mongoose.model('proposal', proposalSchema);
module.exports = Proposal;