// Shared Firestore initialization and data fetching logic
export async function initializeFirestore() {
    const app = firebase.app();
    const db = firebase.firestore();
    
    // Connect to emulator if running locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Using Firestore emulator');
        db.useEmulator('localhost', 8080);
    } else {
        console.log('Using production Firestore');
    }
    
    return db;
}

export async function deleteArticle(db, articleId) {
    try {
        await db.collection('saved_articles').doc(articleId).delete();
        return true;
    } catch (error) {
        console.error('Error deleting article:', error);
        throw error;
    }
}

export async function fetchArticles(db, options = {}) {
    const {
        limit = 10,
        orderBy = 'timestamp',
        orderDirection = 'desc'
    } = options;

    try {
        console.log('Fetching articles with options:', options);
        const snapshot = await db.collection('saved_articles')
            .orderBy(orderBy, orderDirection)
            .limit(limit)
            .get();

        console.log('Found documents:', snapshot.size);
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            console.log('Document data:', data);
            return {
                id: doc.id,
                title: data.title,
                excerpt: data.excerpt,
                url: data.url,
                time: data.timestamp,
                timeAdded: data.timestamp,
                topImage: data.topImage,
                source: data.source || extractDomain(data.url),
                status: data.status,
                tags: data.tags
            };
        });
    } catch (error) {
        console.error('Error fetching articles:', error);
        throw error;
    }
}

// Helper function to extract domain from URL
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return 'Unknown Source';
    }
} 