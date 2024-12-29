import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import express from 'express';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { generateSummaryHTML } from './email-template.js';

const app = express();
app.set('view engine', 'html');

// Initialize Firebase Admin
initializeApp({
    credential: applicationDefault(),
    projectId: 'mindmatter-bfd38'
});

const firestore = getFirestore();

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
            .orderBy('timeAdded', 'desc')
            .limit(10);
        logger.info('Query built with params:', {
            collection: 'saved_articles',
            orderBy: 'timeAdded',
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
                timeAdded: data.timeAdded,
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

/* Keeping this commented out for future scheduling implementation
export const sendDailySummary = onSchedule({
    schedule: '0 9 * * *',
    timeZone: 'America/Denver',
    secrets: ['MAILGUN_API_KEY']
}, async (event) => {
    // ... same implementation as above ...
});
*/

export const save_item_to_db = onRequest(async (req, res) => {
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

     // Log processed data
     logger.info('Processed data', {
       data: documentData,
       dataType: typeof documentData
     });

     // Generate a unique document ID
     const docId = `pocket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
