import { Firestore } from '@google-cloud/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import express from 'express';

const app = express();
app.set('view engine', 'html');

const firestore = new Firestore({
    projectId: 'mindmatter-bfd38'  // Your project ID from the URL
});
  

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
