#!/usr/bin/env node

/**
 * Fix Wells Fargo report - insert from GridFS into ResearchReports
 */

const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
require('dotenv').config();

async function fixWellsFargo() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('Finding latest GridFS report for Wells Fargo (451965)...');

  // Find the latest report in GridFS
  const files = await db.collection('documents.files').find({
    'metadata.idrssd': '451965',
    'metadata.type': 'agent-report'
  }).sort({uploadDate: -1}).limit(1).toArray();

  if (files.length === 0) {
    console.log('No report found in GridFS');
    process.exit(1);
  }

  const file = files[0];
  console.log('Found GridFS file:', file.filename);
  console.log('Upload date:', file.uploadDate);

  // Read the report data from GridFS
  const bucket = new GridFSBucket(db, { bucketName: 'documents' });
  const chunks = [];
  const stream = bucket.openDownloadStream(file._id);

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const reportData = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  console.log('Report bank:', reportData.bankName);
  console.log('Has agentInsights:', reportData.agentInsights ? reportData.agentInsights.length : 0);

  // Check if already exists
  const existing = await db.collection('researchreports').findOne({
    idrssd: '451965',
    fileName: file.filename
  });

  if (existing) {
    console.log('Report already exists in ResearchReports');
    process.exit(0);
  }

  // Insert into ResearchReports
  const result = await db.collection('researchreports').insertOne({
    idrssd: '451965',
    title: 'AI Research Report - ' + reportData.bankName,
    reportData: reportData,
    gridfsFileId: file._id,
    fileName: file.filename,
    agentVersion: 'v2.0',
    generatedAt: file.uploadDate,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log('Inserted report into ResearchReports:', result.insertedId);
  process.exit(0);
}

fixWellsFargo().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
