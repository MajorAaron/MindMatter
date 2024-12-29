import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp({
    projectId: 'mindmatter-bfd38'
});

const firestore = getFirestore();

const sampleArticles = [
    {
        given_url: 'https://example.com/article1',
        given_title: 'The Future of AI Development',
        time_added: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        excerpt: 'An in-depth look at where AI development is heading in the next decade.',
        source: 'TechInsights'
    },
    {
        given_url: 'https://example.com/article2',
        given_title: 'Best Practices for Modern Web Development',
        time_added: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        excerpt: 'A comprehensive guide to modern web development practices and patterns.',
        source: 'Web Dev Weekly'
    },
    {
        given_url: 'https://example.com/article3',
        given_title: 'Understanding Distributed Systems',
        time_added: Math.floor(Date.now() / 1000) - 14400, // 4 hours ago
        excerpt: 'Deep dive into distributed systems architecture and design principles.',
        source: 'System Design Blog'
    },
    {
        given_url: 'https://example.com/article4',
        given_title: 'The Psychology of Productivity',
        time_added: Math.floor(Date.now() / 1000) - 28800, // 8 hours ago
        excerpt: 'Research-based insights into maximizing personal and team productivity.',
        source: 'Mind & Work'
    },
    {
        given_url: 'https://example.com/article5',
        given_title: 'Cloud Native Application Architecture',
        time_added: Math.floor(Date.now() / 1000) - 43200, // 12 hours ago
        excerpt: 'Best practices for building cloud-native applications.',
        source: 'Cloud Architecture Digest'
    }
];

async function seedDatabase() {
    try {
        console.log('Starting database seeding...');
        
        for (const article of sampleArticles) {
            const docId = `pocket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await firestore
                .collection('saved_articles')
                .doc(docId)
                .set(article);
            
            console.log(`Added article: ${article.given_title}`);
        }
        
        console.log('Database seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase(); 