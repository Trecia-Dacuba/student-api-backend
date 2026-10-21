// api/index.js  (Attendance API)
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

// One document per student; dates grow in an array
const AttendanceSchema = new mongoose.Schema({
  student_name: { type: String, required: true, trim: true },
  subject_name: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true },
  attendance_dates: [Date]
}, { timestamps: true });

const Attendance = mongoose.models.Attendance ||
  mongoose.model('Attendance', AttendanceSchema, 'daily_attendance');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectToDatabase();

    // GET: list all students with their attendance dates
    if (req.method === 'GET') {
      return res.status(200).json(await Attendance.find({}).sort({ student_name: 1 }));
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
      const b = req.body || {};
      const student_name = String(b.student_name || '').trim();
      const subject_name = String(b.subject_name || '').trim();
      const section = String(b.section || '').trim();
      const date = String(b.date || '');

      if (!student_name || !subject_name || !section ||
          [student_name, subject_name, section].some(s => s.length > 100) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z'))) {
        return res.status(400).json({ error: 'Invalid input' });
      }
      const day = new Date(date + 'T00:00:00Z');
      const filter = { student_name, subject_name, section };

      // POST: mark present (creates the student if new, never duplicates a date)
      if (req.method === 'POST') {
        const doc = await Attendance.findOneAndUpdate(filter,
          { $addToSet: { attendance_dates: day } },
          { upsert: true, new: true, setDefaultsOnInsert: true });
        return res.status(200).json(doc);
      }

      // DELETE: undo a wrongly marked date
      const doc = await Attendance.findOneAndUpdate(filter,
        { $pull: { attendance_dates: day } }, { new: true });
      return doc ? res.status(200).json(doc) : res.status(404).json({ error: 'Not found' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
};