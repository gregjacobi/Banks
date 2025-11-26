/**
 * Script to set up MongoDB vector search index for grounding chunks
 * Run this once after uploading your first document
 *
 * Usage: node server/scripts/setupVectorIndex.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

async function setupVectorIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const collection = db.collection('groundingchunks');

    console.log('\nCreating vector search index...');
    console.log('Index name: vector_index');
    console.log('Dimensions: 1024 (Voyage-3)');
    console.log('Similarity: cosine');

    // Check if index already exists
    const indexes = await collection.listSearchIndexes().toArray();
    const existingIndex = indexes.find(idx => idx.name === 'vector_index');

    if (existingIndex) {
      console.log('\n⚠️  Vector index already exists!');
      console.log('Current index:', JSON.stringify(existingIndex, null, 2));
      console.log('\nTo recreate, first drop it with:');
      console.log('  db.groundingchunks.dropSearchIndex("vector_index")');
      await mongoose.disconnect();
      return;
    }

    // Create the vector search index
    await collection.createSearchIndex({
      name: 'vector_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 1024,
            similarity: 'cosine'
          },
          {
            type: 'filter',
            path: 'bankTypes'
          },
          {
            type: 'filter',
            path: 'topics'
          },
          {
            type: 'filter',
            path: 'assetSizeRange'
          },
          {
            type: 'filter',
            path: 'documentId'
          }
        ]
      }
    });

    console.log('\n✓ Vector search index created successfully!');
    console.log('\nℹ️  Note: Index building may take a few minutes.');
    console.log('Check status with: db.groundingchunks.listSearchIndexes()');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');

  } catch (error) {
    console.error('\n❌ Error setting up vector index:', error);
    console.error('\nMake sure:');
    console.error('1. MongoDB 6.0.11+ or 7.0.2+ is running');
    console.error('2. Your MongoDB server supports vector search');
    console.error('3. You have at least one grounding chunk in the database');
    process.exit(1);
  }
}

setupVectorIndex();
