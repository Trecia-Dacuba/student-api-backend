// api/index.js  (Attendance API)
const connectToDatabase = require('../db');
const mongoose = require('mongoose');

// Same design as the midterm: one document per student, dates grow in an array
const AttendanceSchema = new mongoose.Schema({
  student_name: { type: String, required: true, trim: true },
  subject_name: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true },
  attendance_dates: [Date]
}, { timestamps: true });

const Attendance = mongoose.models.Attendance ||
  mongoose.model('Attendance', AttendanceSchema, 'daily_attendance');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectToDatabase();

    // GET: list all students with their attendance dates
    if (req.method === 'GET') {
      const records = await Attendance.find({}).sort({ student_name: 1 });
      return res.status(200).json(records);
    }

    // POST: mark a student present on a date (creates the student if new)
    if (req.method === 'POST') {
      const b = req.body || {};
      const student_name = String(b.student_name || '').trim();
      const subject_name = String(b.subject_name || '').trim();
      const section = String(b.section || '').trim();
      const date = String(b.date || '');

      if (!student_name || !subject_name || !section ||
          [student_name, subject_name, section].some(s => s.length > 100) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid input' });
      }

      const day = new Date(date + 'T00:00:00Z');
      const doc = await Attendance.findOneAndUpdate(
        { student_name, subject_name, section },
        { $addToSet: { attendance_dates: day } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.status(200).json(doc);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
};