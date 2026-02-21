const express = require('express');
const db = require('./db');
const OpenAI = require('openai');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const router = express.Router();

// OpenAI setup - latest v4 syntax
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validation error handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Centralized DB error handler
const handleDBError = (err, res) => {
  console.error('Database Error:', err.code, err.message);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry – this already exists' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Invalid reference – course or instructor does not exist' });
  }
  if (err.code === 'ER_TRUNCATED_WRONG_VALUE') {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  res.status(500).json({ error: 'Database error occurred' });
};

// ==================== COURSES ====================
router.post('/courses', [
  body('name').notEmpty().trim().escape().withMessage('Course name is required'),
  body('credits').isInt({ min: 1 }).withMessage('Credits must be at least 1'),
  body('prerequisites').optional().trim().escape()
], validate, async (req, res) => {
  const { name, credits, prerequisites } = req.body;
  try {
    await db.query(
      'INSERT INTO courses (name, credits, prerequisites) VALUES (?, ?, ?)',
      [name, credits, prerequisites || null]
    );
    res.status(201).json({ message: 'Course added successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

router.get('/courses', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM courses ORDER BY name');
    res.json(rows);
  } catch (err) {
    handleDBError(err, res);
  }
});

router.put('/courses/:id', [
  body('name').optional().notEmpty().trim().escape(),
  body('credits').optional().isInt({ min: 1 }),
  body('prerequisites').optional().trim().escape()
], validate, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const fields = [];
    const values = [];

    if (updates.name) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.credits) { fields.push('credits = ?'); values.push(updates.credits); }
    if (updates.prerequisites !== undefined) { fields.push('prerequisites = ?'); values.push(updates.prerequisites || null); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    values.push(id);
    const [result] = await db.query(
      `UPDATE courses SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Course updated successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

router.delete('/courses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM courses WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

// ==================== INSTRUCTORS ====================
router.post('/instructors', [
  body('name').notEmpty().trim().escape().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], validate, async (req, res) => {
  const { name, email } = req.body;
  try {
    await db.query('INSERT INTO instructors (name, email) VALUES (?, ?)', [name, email]);
    res.status(201).json({ message: 'Instructor added successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

router.get('/instructors', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM instructors ORDER BY name');
    res.json(rows);
  } catch (err) {
    handleDBError(err, res);
  }
});

router.put('/instructors/:id', [
  body('name').optional().notEmpty().trim().escape(),
  body('email').optional().isEmail().normalizeEmail()
], validate, async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  try {
    const fields = [];
    const values = [];

    if (name) { fields.push('name = ?'); values.push(name); }
    if (email) { fields.push('email = ?'); values.push(email); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    values.push(id);
    const [result] = await db.query(
      `UPDATE instructors SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    res.json({ message: 'Instructor updated successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

router.delete('/instructors/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM instructors WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Instructor not found' });
    }
    res.json({ message: 'Instructor deleted successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

// ==================== COURSE-INSTRUCTOR ASSIGNMENTS ====================
router.post('/course-instructors', [
  body('course_id').isInt().toInt(),
  body('instructor_id').isInt().toInt()
], validate, async (req, res) => {
  const { course_id, instructor_id } = req.body;
  try {
    await db.query(
      'INSERT INTO course_instructors (course_id, instructor_id) VALUES (?, ?)',
      [course_id, instructor_id]
    );
    res.status(201).json({ message: 'Course assigned to instructor successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        error: 'This course is already assigned to this instructor' 
      });
    }
    handleDBError(err, res);
  }
});

router.get('/course-instructors', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ci.id,
        c.name AS course_name,
        i.name AS instructor_name,
        ci.course_id,
        ci.instructor_id
      FROM course_instructors ci
      JOIN courses c ON ci.course_id = c.id
      JOIN instructors i ON ci.instructor_id = i.id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    handleDBError(err, res);
  }
});

router.delete('/course-instructors/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM course_instructors WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ message: 'Assignment removed successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

// ==================== AVAILABILITIES ====================
router.post('/availabilities', [
  body('instructor_id').isInt({ min: 1 }).withMessage('Valid instructor ID required').toInt(),
  body('day').isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Valid day required'),
  body('start_time').notEmpty().withMessage('Start time required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format (e.g., 09:00)'),
  body('end_time').notEmpty().withMessage('End time required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format (e.g., 10:00)')
], validate, async (req, res) => {
  let { instructor_id, day, start_time, end_time } = req.body;

  // Automatically add :00 for MySQL TIME compatibility
  start_time = `${start_time}:00`;
  end_time = `${end_time}:00`;

  // Check if start < end
  if (start_time >= end_time) {
    return res.status(400).json({ error: 'Start time must be before end time' });
  }

  try {
    // Optional: Advanced overlap detection (same instructor, same day)
    const [overlaps] = await db.query(`
      SELECT id FROM availabilities 
      WHERE instructor_id = ? 
        AND day = ?
        AND (
          (start_time < ? AND end_time > ?) OR   -- New overlaps existing
          (start_time < ? AND end_time > ?) OR
          (start_time = ? AND end_time = ?)      -- Exact same (optional)
        )
    `, [instructor_id, day, end_time, start_time, start_time, end_time, start_time, end_time]);

    if (overlaps.length > 0) {
      return res.status(409).json({ error: 'This time slot overlaps with an existing availability' });
    }

    // Insert
    await db.query(
      'INSERT INTO availabilities (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)',
      [instructor_id, day, start_time, end_time]
    );

    res.status(201).json({ message: 'Availability added successfully!' });
  } catch (err) {
    handleDBError(err, res);
  }
});

// GET with instructor name (already good, minor improvement)
router.get('/availabilities', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        a.id,
        a.day,
        TIME_FORMAT(a.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(a.end_time, '%H:%i') AS end_time,
        a.instructor_id,
        i.name AS instructor_name
      FROM availabilities a
      JOIN instructors i ON a.instructor_id = i.id
      ORDER BY i.name, FIELD(a.day, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), a.start_time
    `);
    res.json(rows);
  } catch (err) {
    handleDBError(err, res);
  }
});


router.get('/course-instructors', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ci.id,
        c.name AS course_name,
        i.name AS instructor_name,
        ci.course_id,
        ci.instructor_id
      FROM course_instructors ci
      JOIN courses c ON ci.course_id = c.id
      JOIN instructors i ON ci.instructor_id = i.id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    handleDBError(err, res);
  }
});

router.delete('/course-instructors/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM course_instructors WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ message: 'Assignment removed successfully' });
  } catch (err) {
    handleDBError(err, res);
  }
});

// ==================== GENERATE TIMETABLE ====================
router.post('/generate-timetable', async (req, res) => {
  try {
    const [courses] = await db.query('SELECT * FROM courses');
    const [instructors] = await db.query('SELECT * FROM instructors');
    const [availabilities] = await db.query('SELECT * FROM availabilities');
    const [assignments] = await db.query('SELECT * FROM course_instructors');

    if (assignments.length === 0) {
      return res.status(400).json({ 
        error: 'Cannot generate timetable: No course-instructor assignments found. Please assign instructors to courses first.' 
      });
    }

    const prompt = `
You are an expert university timetable scheduler. Generate a realistic weekly timetable based on the given data.

Data Provided:
- Courses: ${JSON.stringify(courses)}
- Instructors: ${JSON.stringify(instructors)}
- Instructor Availabilities: ${JSON.stringify(availabilities)}
- Course-Instructor Assignments: ${JSON.stringify(assignments)}

Strict Rules:
1. Only assign a course to an instructor if they are linked in the assignments.
2. Never schedule any instructor at conflicting times (even on different days).
3. Strictly respect each instructor's availability (day and time range).
4. Balance classes across the week – avoid overloading one day.
5. Use logical 1-hour slots (e.g., 09:00-10:00, 10:00-11:00, etc.).
6. Each course should appear exactly once unless credits suggest multiple sessions (use judgment).

Output ONLY valid JSON in this exact format. No explanations, no markdown:
{
  "days": {
    "Monday": [
      {"time": "09:00-10:00", "course": "Database Systems", "instructor": "Dr. Ahmed"}
    ],
    "Tuesday": [ ... ],
    ...
  }
}

If scheduling is impossible, return: {"error": "Unable to generate valid timetable due to constraints"}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: "json_object" } // Enforce JSON mode (recommended)
    });

    const content = completion.choices[0].message.content.trim();
    let timetable;

    try {
      timetable = JSON.parse(content);
      if (timetable.error) {
        return res.status(400).json({ error: timetable.error });
      }
    } catch (parseError) {
      console.error('AI returned invalid JSON:', content);
      return res.status(500).json({ 
        error: 'AI failed to generate valid timetable format. Please try again.' 
      });
    }

    // Save to history
    await db.query(
      'INSERT INTO timetables (generated_data) VALUES (?)',
      [JSON.stringify(timetable)]
    );

    res.json({ 
      message: 'Timetable generated successfully!',
      timetable 
    });

  } catch (err) {
    console.error('Timetable generation failed:', err);
    res.status(500).json({ error: 'Failed to generate timetable. Please try again later.' });
  }
});

// Get timetable history
router.get('/timetables', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, created_at, generated_data 
      FROM timetables 
      ORDER BY created_at DESC
    `);

    const parsed = rows.map(row => {
      let data;
      try {
        // Safe parse – agar invalid JSON, null ya empty object return
        data = row.generated_data ? JSON.parse(row.generated_data) : { days: {} };
      } catch (parseErr) {
        console.warn(`Invalid JSON in timetable ID ${row.id}:`, row.generated_data);
        data = { error: "Corrupted timetable data", days: {} };
      }

      return {
        id: row.id,
        created_at: row.created_at,
        generated_data: data
      };
    });

    res.json(parsed);
  } catch (err) {
    handleDBError(err, res);
  }
});

// TEST ROUTE - Sirf check karne ke liye
router.get('/test', (req, res) => {
  res.json({ message: 'Routes file is working!' });
});

module.exports = router;