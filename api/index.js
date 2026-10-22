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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectToDatabase();

    // GET: list all students with their attendance dates
    if (req.method === 'GET') {
      return res.status(200).json(await Attendance.find({}).sort({ student_name: 1 }));
    }

    const clean = v => String(v || '').trim();
    const bad = v => !v || v.length > 100;

    // PATCH: edit one student by id, or rename a whole section/subject
    if (req.method === 'PATCH') {
      const b = req.body || {};
      if (b.rename) {
        const field = b.rename.field, from = clean(b.rename.from), to = clean(b.rename.to);
        if (!['section', 'subject_name'].includes(field) || !from || bad(to)) return res.status(400).json({ error: 'Invalid input' });
        const r = await Attendance.updateMany({ [field]: from }, { $set: { [field]: to } });
        return res.status(200).json({ modified: r.modifiedCount });
      }
      if (!mongoose.isValidObjectId(b.id)) return res.status(400).json({ error: 'Invalid id' });
      const f = { student_name: clean(b.student_name), subject_name: clean(b.subject_name), section: clean(b.section) };
      if (Object.values(f).some(bad)) return res.status(400).json({ error: 'Invalid input' });
      if (await Attendance.findOne({ ...f, _id: { $ne: b.id } })) return res.status(409).json({ error: 'A student with these details already exists' });
      const doc = await Attendance.findByIdAndUpdate(b.id, f, { new: true });
      return doc ? res.status(200).json(doc) : res.status(404).json({ error: 'Not found' });
    }

    // DELETE with student_id: remove the whole student record
    if (req.method === 'DELETE' && req.body && req.body.student_id) {
      if (!mongoose.isValidObjectId(req.body.student_id)) return res.status(400).json({ error: 'Invalid id' });
      const doc = await Attendance.findByIdAndDelete(req.body.student_id);
      return doc ? res.status(200).json({ deleted: true }) : res.status(404).json({ error: 'Not found' });
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