import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
initializeApp({
    credential: cert('./functions/service-account-key.json'),
    projectId: 'mindmatter-bfd38'
});

const firestore = getFirestore();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
    try {
        console.log('Starting migration from Firebase to Supabase...');
        
        // Get all documents from the saved_articles collection
        const snapshot = await firestore.collection('saved_articles').get();
        
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Check if required url field is present
            if (!data.url) {
                console.log(`Skipping document ${doc.id} - Missing required URL field`);
                console.log('Document data:', data);
                skippedCount++;
                continue;
            }
            
            try {
                // Convert Firebase timestamp to ISO string if it exists
                let timeAdded = null;
                if (data.timestamp && data.timestamp._seconds) {
                    timeAdded = new Date(data.timestamp._seconds * 1000).toISOString();
                } else if (data.time) {
                    timeAdded = new Date(parseInt(data.time) * 1000).toISOString();
                }

                // Convert tags string to array if it exists
                let tags = null;
                if (data.tags) {
                    tags = data.tags.split(',').filter(tag => tag.trim() !== '');
                }
                
                // Insert into Supabase
                const { error } = await supabase
                    .from('saved_articles')
                    .insert({
                        url: data.url,
                        title: data.title || null,
                        time_added: timeAdded,
                        excerpt: data.excerpt || null,
                        source: data.source || null,
                        tags: tags || []
                    });
                
                if (error) {
                    console.error(`Error inserting document ${doc.id}:`, error);
                    errorCount++;
                } else {
                    console.log(`Successfully migrated document: ${doc.id}`);
                    successCount++;
                }
            } catch (error) {
                console.error(`Error processing document ${doc.id}:`, error);
                errorCount++;
            }
        }
        
        console.log('\nMigration completed!');
        console.log(`Successfully migrated: ${successCount} documents`);
        console.log(`Failed to migrate: ${errorCount} documents`);
        console.log(`Skipped (invalid data): ${skippedCount} documents`);
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
migrateData(); 