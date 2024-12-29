import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'service-account-key.json');

async function testProductionRead() {
    try {
        // Load service account
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        console.log('Using service account for project:', serviceAccount.project_id);

        // Initialize Firebase Admin (production only)
        const app = initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id
        });

        const db = getFirestore(app);
        
        console.log('\nTesting production read...');
        
        // Try to list all collections first
        console.log('\nListing all collections:');
        const collections = await db.listCollections();
        console.log('Available collections:', collections.map(col => col.id));

        // Try to read from saved_articles
        console.log('\nReading from saved_articles:');
        const snapshot = await db.collection('saved_articles').get();
        
        console.log(`Found ${snapshot.size} documents in saved_articles`);
        
        // Log each document
        snapshot.forEach(doc => {
            console.log('\nDocument ID:', doc.id);
            console.log('Document data:', JSON.stringify(doc.data(), null, 2));
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

testProductionRead(); 