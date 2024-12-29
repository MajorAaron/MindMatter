import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'service-account-key.json');

async function copyToEmulator() {
    try {
        // Load service account
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        console.log('Using service account for project:', serviceAccount.project_id);

        // Initialize Firebase Admin for production (without emulator settings)
        console.log('\nInitializing production connection...');
        const prodApp = initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id
        }, 'production');

        // Get production data first
        const prodDb = getFirestore(prodApp);
        console.log('\nReading from production saved_articles...');
        
        // Get all documents
        const snapshot = await prodDb.collection('saved_articles').get();
        console.log(`Found ${snapshot.size} documents in production`);

        // Convert to array and sort by time
        const articles = snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        }));

        // Sort by time (assuming time field exists)
        articles.sort((a, b) => {
            const timeA = a.data.time?._seconds || 0;
            const timeB = b.data.time?._seconds || 0;
            return timeB - timeA; // descending order
        });

        // Take only the 20 most recent
        const recentArticles = articles.slice(0, 10);
        console.log(`Selected ${recentArticles.length} most recent articles`);

        // Now set up emulator and copy the data
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
        console.log('\nInitializing emulator connection...');
        const emulatorApp = initializeApp({
            projectId: serviceAccount.project_id
        }, 'emulator');
        
        const emulatorDb = getFirestore(emulatorApp);
        
        // Copy each document to emulator
        let copied = 0;
        for (const article of recentArticles) {
            try {
                await emulatorDb.collection('saved_articles').doc(article.id).set(article.data);
                copied++;
                console.log(`Copied ${copied} of ${recentArticles.length} documents`);
            } catch (error) {
                console.error(`Error copying document ${article.id}:`, error);
            }
        }

        console.log(`\nSuccessfully copied ${copied} documents to emulator`);

    } catch (error) {
        console.error('Error:', error);
    }
}

copyToEmulator(); 