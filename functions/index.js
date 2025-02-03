import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import express from 'express';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { generateSummaryHTML } from './email-template.js';
import supabase from '../supabaseClient.js';

// Initialize Firebase Admin
initializeApp({
    credential: applicationDefault(),
    projectId: 'mindmatter-bfd38',
    storageBucket: 'mindmatter-bfd38.appspot.com'
});

const firestore = getFirestore();
const storage = getStorage();

// Use the default bucket without domain verification
const bucket = storage.bucket('mindmatter-bfd38');

// Log storage information
logger.info('Storage initialization:', {
    defaultBucket: bucket.name,
    projectId: 'mindmatter-bfd38'
});

// Function to ensure bucket exists
async function ensureBucketExists() {
    try {
        const [exists] = await bucket.exists();
        if (!exists) {
            logger.info('Bucket does not exist, creating it...');
            await bucket.create({
                location: 'US',
                storageClass: 'STANDARD'
            });
        }
        logger.info('Bucket verified:', bucket.name);
        
        // Set public access
        try {
            await bucket.iam.setPolicy({
                bindings: [
                    {
                        role: 'roles/storage.objectViewer',
                        members: ['allUsers']
                    }
                ]
            });
            logger.info('Bucket public access configured');
        } catch (policyError) {
            logger.warn('Could not set bucket policy:', policyError.message);
        }
    } catch (error) {
        logger.error('Error checking/creating bucket:', {
            error: error.message,
            bucketName: bucket.name
        });
        throw error;
    }
}

// Function to download and store image
async function downloadAndStoreImage(imageUrl, articleId) {
    try {
        if (!imageUrl) {
            logger.warn('No image URL provided');
            return null;
        }

        logger.info('Starting image download process', {
            imageUrl,
            articleId,
            environment: process.env.FUNCTIONS_EMULATOR ? 'emulator' : 'production'
        });

        // Generate a unique filename
        const timestamp = Date.now();
        const fileName = `article-images/pocket_${articleId}_${timestamp}.jpg`;

        // Download the image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
        }

        const contentType = imageResponse.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}`);
        }

        // Get the image data as a buffer
        const imageBuffer = await imageResponse.arrayBuffer();

        // Upload image to Supabase Storage bucket named 'article-images'
        const { error: uploadError } = await supabase
            .storage
            .from('article-images')
            .upload(fileName, Buffer.from(imageBuffer), { contentType });

        if (uploadError) {
            throw new Error(uploadError.message);
        }

        // Get the public URL for the file
        const { publicURL, error: urlError } = supabase
            .storage
            .from('article-images')
            .getPublicUrl(fileName);

        if (urlError) {
            throw new Error(urlError.message);
        }

        logger.info('Successfully uploaded image', {
            fileName,
            publicUrl: publicURL,
            contentType
        });

        return publicURL;
    } catch (error) {
        logger.error('Failed to process image:', {
            error: error.message,
            imageUrl,
            articleId,
            stack: error.stack
        });
        // Return the original URL if storage fails
        return imageUrl;
    }
}

// Initialize Mailgun
const mailgun = new Mailgun(FormData);

// Daily summary function that can be triggered via HTTP
export const sendDailySummaryHttp = onRequest({
    secrets: ['MAILGUN_API_KEY']
}, async (req, res) => {
    try {
        logger.info('Starting query execution...');
        
        // Initialize Mailgun client with secret
        const mg = mailgun.client({
            username: 'api',
            key: process.env.MAILGUN_API_KEY
        });
        
        // List all collections to debug
        const collections = await firestore.listCollections();
        logger.info('Available collections:', collections.map(col => col.id));
        
        // Query Firestore for the last 10 articles
        const articlesRef = firestore.collection('saved_articles');
        logger.info('Collection reference created for: saved_articles');
        
        // First check if the collection exists and has documents
        const collectionSnapshot = await articlesRef.limit(1).get();
        logger.info('Collection check:', {
            exists: !collectionSnapshot.empty,
            path: articlesRef.path,
            firstDoc: collectionSnapshot.empty ? null : Object.keys(collectionSnapshot.docs[0].data())
        });
        
        const query = articlesRef
            .orderBy('timestamp', 'desc')
            .limit(10);
        logger.info('Query built with params:', {
            collection: 'saved_articles',
            orderBy: 'timestamp',
            limit: 10
        });
        
        const snapshot = await query.get();
        logger.info('Query executed with results:', {
            isEmpty: snapshot.empty,
            size: snapshot.size
        });

        if (snapshot.empty) {
            logger.info('No articles found in the database');
            res.json({ message: 'No articles found in the database' });
            return;
        }

        // Convert documents to the format expected by generateSummaryHTML
        const articles = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || data.given_title,
                excerpt: data.excerpt,
                url: data.url || data.given_url,
                timeAdded: data.timestamp,
                topImage: data.topImage,
                source: data.source
            };
        });

        // Generate email HTML using our template
        const htmlContent = generateSummaryHTML(articles, {
            isEmail: true,
            timeframe: 'daily'
        });
        
        logger.info('Preparing email message...');
        
        const msg = {
            from: 'MindMatter <mindmatter@mindmatter.app>',
            to: 'aaron265@gmail.com',
            subject: `MindMatter Summary - ${new Date().toLocaleDateString()}`,
            html: htmlContent
        };

        logger.info('Attempting to send email with Mailgun...');

        await mg.messages.create('mindmatter.app', msg);
        logger.info('Summary email sent successfully');
        res.json({ 
            message: 'Summary email sent successfully',
            articleCount: snapshot.size
        });

    } catch (error) {
        logger.error('Error sending summary:', error);
        res.status(500).json({
            error: 'Failed to send summary',
            details: error.message,
            stack: error.stack
        });
    }
});

// Morning summary scheduled function
export const sendMorningSummary = onSchedule({
    schedule: '0 8 * * *',  // 8:00 AM every day
    timeZone: 'America/Denver',
    secrets: ['MAILGUN_API_KEY']
}, async (event) => {
    try {
        logger.info('Starting morning summary execution...');
        
        // Initialize Mailgun client with secret
        const mg = mailgun.client({
            username: 'api',
            key: process.env.MAILGUN_API_KEY
        });
        
        // Query Firestore for the last 10 articles
        const articlesRef = firestore.collection('saved_articles');
        const snapshot = await articlesRef
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            logger.info('No articles found for morning summary');
            return;
        }

        // Convert documents to the format expected by generateSummaryHTML
        const articles = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || data.given_title,
                excerpt: data.excerpt,
                url: data.url || data.given_url,
                timeAdded: data.timestamp,
                topImage: data.topImage,
                source: data.source
            };
        });

        // Generate email HTML
        const htmlContent = generateSummaryHTML(articles, {
            isEmail: true,
            timeframe: 'Morning'
        });
        
        const msg = {
            from: 'MindMatter <mindmatter@mindmatter.app>',
            to: 'aaron265@gmail.com',
            subject: `MindMatter Morning Summary - ${new Date().toLocaleDateString()}`,
            html: htmlContent
        };

        await mg.messages.create('mindmatter.app', msg);
        logger.info('Morning summary email sent successfully');

    } catch (error) {
        logger.error('Error sending morning summary:', error);
        throw error;
    }
});

// Evening summary scheduled function
export const sendEveningSummary = onSchedule({
    schedule: '0 20 * * *',  // 8:00 PM every day
    timeZone: 'America/Denver',
    secrets: ['MAILGUN_API_KEY']
}, async (event) => {
    try {
        logger.info('Starting evening summary execution...');
        
        // Initialize Mailgun client with secret
        const mg = mailgun.client({
            username: 'api',
            key: process.env.MAILGUN_API_KEY
        });
        
        // Query Firestore for the last 10 articles
        const articlesRef = firestore.collection('saved_articles');
        const snapshot = await articlesRef
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            logger.info('No articles found for evening summary');
            return;
        }

        // Convert documents to the format expected by generateSummaryHTML
        const articles = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || data.given_title,
                excerpt: data.excerpt,
                url: data.url || data.given_url,
                timeAdded: data.timestamp,
                topImage: data.topImage,
                source: data.source
            };
        });

        // Generate email HTML
        const htmlContent = generateSummaryHTML(articles, {
            isEmail: true,
            timeframe: 'Evening'
        });
        
        const msg = {
            from: 'MindMatter <mindmatter@mindmatter.app>',
            to: 'aaron265@gmail.com',
            subject: `MindMatter Evening Summary - ${new Date().toLocaleDateString()}`,
            html: htmlContent
        };

        await mg.messages.create('mindmatter.app', msg);
        logger.info('Evening summary email sent successfully');

    } catch (error) {
        logger.error('Error sending evening summary:', error);
        throw error;
    }
});

export const save_item_to_db = onRequest({
    cors: true,
    ingressSettings: 'ALLOW_ALL',  // Allow incoming requests
    invoker: 'public',
    cpu: 1,
    memory: '256MiB',
    maxInstances: 10,
    minInstances: 0,
    timeoutSeconds: 60,
    labels: {
        type: 'article-save'
    }
}, async (req, res) => {
   res.set('Access-Control-Allow-Origin', '*');
   res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
   res.set('Access-Control-Allow-Headers', 'Content-Type');
  
   if (req.method === 'OPTIONS') {
     // Send response to OPTIONS requests
     res.set('Access-Control-Allow-Methods', 'POST');
     res.set('Access-Control-Allow-Headers', 'Content-Type');
     res.status(204).send('');
     return;
   }
 
   try {
     // Check if request method is POST
     if (req.method !== 'POST') {
       res.status(405).send('Method Not Allowed');
       return;
     }

     // Log request details using Firebase logger
     logger.info('Request body received', {
       body: req.body,
       bodyType: typeof req.body
     });

     // Get the first item from the array if body is an array, otherwise use body as is
     const data = Array.isArray(req.body) ? req.body[0] : req.body;

     // If data is a string, try to parse it
     const documentData = typeof data === 'string' ? JSON.parse(data) : data;

     // Add server timestamp
     documentData.timestamp = FieldValue.serverTimestamp();

     // Generate a unique document ID
     const docId = `pocket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

     // If there's a top image URL, download and store it
     if (documentData.topImage) {
       try {
         logger.info('Downloading and storing image:', documentData.topImage);
         const storedImageUrl = await downloadAndStoreImage(documentData.topImage, docId);
         documentData.originalTopImage = documentData.topImage; // Store original URL as backup
         documentData.topImage = storedImageUrl;
         logger.info('Successfully stored and updated image URL:', storedImageUrl);
       } catch (imageError) {
         logger.error('Failed to store image:', {
           error: imageError.message,
           originalUrl: documentData.topImage
         });
         // Keep the original image URL if storage fails
         documentData.topImage = documentData.topImage;
       }
     }

     // Log processed data
     logger.info('Processed data', {
       data: documentData,
       dataType: typeof documentData
     });

     // Save to Firestore
     await firestore
       .collection('saved_articles')
       .doc(docId)
       .set(documentData);

     // Send success response
     res.status(200).json({
       message: 'Successfully saved Pocket item',
       docId: docId
     });

   } catch (error) {
     console.error('Error saving Pocket item:', error);
     res.status(500).json({
       error: 'Internal server error',
       details: error.message
     });
   }
});

export const fetch_article_image = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const url = req.query.url;
        if (!url) {
            res.status(400).json({ error: 'URL parameter is required' });
            return;
        }

        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        // Try to find an image in this order:
        // 1. og:image meta tag
        // 2. twitter:image meta tag
        // 3. First large image in the content
        let imageUrl = $('meta[property="og:image"]').attr('content') ||
                      $('meta[name="twitter:image"]').attr('content');

        if (!imageUrl) {
            // Look for the first large image
            $('img').each((i, elem) => {
                const src = $(elem).attr('src');
                if (src && src.startsWith('http')) {
                    imageUrl = src;
                    return false; // break the loop
                }
            });
        }

        res.status(200).json({ imageUrl });
    } catch (error) {
        console.error('Error fetching article image:', error);
        res.status(500).json({
            error: 'Failed to fetch article image',
            details: error.message
        });
    }
});
