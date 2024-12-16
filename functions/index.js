const { Firestore } = require('@google-cloud/firestore');
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const firestore = new Firestore({
    projectId: 'mindmatter-bfd38'  // Your project ID from the URL
});
  

exports.save_item_to_db = onRequest(async (req, res) => {
   logger.info("Hello logs!", {structuredData: true});
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
 
     // Get Pocket item data from request body
     const pocketItem = req.body;
 
     // Basic validation
     if (!pocketItem || !pocketItem.given_url) {
       res.status(400).send('Invalid Pocket item data');
       return;
     }
 
     // Create a document with the data
     const processedItem = {
       url: pocketItem.given_url,
       title: pocketItem.given_title || '',
       excerpt: pocketItem.excerpt || '',
       timeAdded: new Date(),
       topImage: pocketItem.top_image_url || '',
       status: 'unread',
       source: pocketItem.source,
       time: pocketItem.time_added
     };
 
     // Generate a unique document ID
     const docId = `pocket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
 
     // Save to Firestore
     await firestore
       .collection('saved_articles')
       .doc(docId)
       .set(processedItem);
 
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
