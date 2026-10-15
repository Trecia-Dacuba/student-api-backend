     // api/index.js
     const connectToDatabase = require('../db');
     const mongoose = require('mongoose');

     // Define the database schema for the student project
     const RecordSchema = new mongoose.Schema({
       title: String,
       content: String
     }, { timestamps: true });

     const Record = mongoose.models.Record || mongoose.model('Record', RecordSchema);

     module.exports = async (req, res) => {
       // Enable CORS so GitHub Pages can communicate with this API
       res.setHeader('Access-Control-Allow-Credentials', true);
       res.setHeader('Access-Control-Allow-Origin', '*');
       res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
       res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

       if (req.method === 'OPTIONS') {
         return res.status(200).end();
       }

       try {
         await connectToDatabase();

         // Handle fetching data (GET)
         if (req.method === 'GET') {
           const records = await Record.find({}).sort({ createdAt: -1 });
           return res.status(200).json(records);
         }

         // Handle submitting new data (POST)
         if (req.method === 'POST') {
           const newRecord = await Record.create(req.body);
           return res.status(201).json(newRecord);
         }

         return res.status(405).json({ error: 'Method Not Allowed' });
       } catch (error) {
         console.error(error);
         return res.status(500).json({ error: 'Database connection failed' });
       }
     };