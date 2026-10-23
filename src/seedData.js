const db = require('./db');

const names = [
  ['Aarav', 'Sharma'], ['Diya', 'Patel'], ['Kabir', 'Mehta'], ['Anaya', 'Rao'],
  ['Vivaan', 'Iyer'], ['Myra', 'Nair'], ['Arjun', 'Kapoor'], ['Sara', 'Khan'],
  ['Reyansh', 'Singh'], ['Aadhya', 'Joshi'], ['Vihaan', 'Desai'], ['Ishita', 'Bose'],
  ['Advik', 'Mishra'], ['Kiara', 'Verma'], ['Rohan', 'Chopra'], ['Meera', 'Pillai'],
  ['Atharv', 'Malhotra'], ['Tara', 'Kulkarni'], ['Neil', 'Saxena'], ['Zoya', 'Menon']
];
const classes = ['8-A', '8-B', '9-A', '9-B', '10-A', '10-B', '11-A', '12-A'];
const departments = ['Science', 'Commerce', 'Humanities'];
const illnesses = [
  ['Seasonal flu', 'Paracetamol 500mg', 'Rest and hydration advised'],
  ['Mild asthma', 'Salbutamol inhaler', 'Keep inhaler available during sports'],
  ['Stomach ache', 'Oral rehydration salts', 'Monitor symptoms and diet'],
  ['Migraine', 'Ibuprofen 200mg', 'Rested in the nurse room until improved']
];
const incidentTypes = ['Slip and fall', 'Minor sports injury', 'Bullying concern', 'Unauthorized access', 'Property damage'];
const locations = ['Science lab', 'Basketball court', 'East corridor', 'Library', 'Main gate', 'Cafeteria'];
const violations = ['Late arrival', 'Disruptive conduct', 'Uniform violation', 'Unauthorized device use', 'Repeated absence'];
const alertTypes = ['Parent follow-up', 'Medical review', 'Safety review', 'Attendance concern'];

let seed = 20261023;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const pick = values => values[Math.floor(random() * values.length)];
const date = (daysAgo = 0) => {
  const d = new Date(Date.UTC(2026, 9, 23));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};
const dateTime = daysAgo => `${date(daysAgo)} ${String(8 + Math.floor(random() * 9)).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00`;

if (db.prepare("SELECT COUNT(*) n FROM student WHERE phone LIKE '+91 98000 %'").get().n > 0) {
  console.log('Seed data already exists; no rows were added.');
  process.exit(0);
}

const insertStudent = db.prepare('INSERT INTO student(name,dob,gender,class,department,phone) VALUES(?,?,?,?,?,?)');
const insertParent = db.prepare('INSERT INTO parent(name,phone,email) VALUES(?,?,?)');
const insertLink = db.prepare('INSERT INTO student_parent(student_id,parent_id,relation) VALUES(?,?,?)');
const insertStaff = db.prepare('INSERT INTO staff(name,role,phone) VALUES(?,?,?)');
const insertHealth = db.prepare('INSERT INTO health_record(student_id,date,illness,medication,doctor_notes) VALUES(?,?,?,?,?)');
const insertIncident = db.prepare('INSERT INTO safety_incident(student_id,date,location,incident_type,severity,description,staff_id) VALUES(?,?,?,?,?,?,?)');
const insertDiscipline = db.prepare('INSERT INTO discipline_record(student_id,date,violation,action_taken,status) VALUES(?,?,?,?,?)');
const insertAlert = db.prepare('INSERT INTO alert(student_id,staff_id,alert_type,date_time,status) VALUES(?,?,?,?,?)');

db.exec('BEGIN');
try {
  const staff = [
    ['Priya Menon', 'School Counselor', '+91 90000 10001'],
    ['Rahul Thomas', 'Sports Coordinator', '+91 90000 10002'],
    ['Neha Gupta', 'Class Teacher', '+91 90000 10003'],
    ['Imran Ali', 'Safety Officer', '+91 90000 10004']
  ].map(row => insertStaff.run(...row).lastInsertRowid);

  names.forEach(([first, last], index) => {
    const student = insertStudent.run(
      `${first} ${last}`, `2010-${String(1 + (index % 9)).padStart(2, '0')}-${String(3 + (index % 24)).padStart(2, '0')}`,
      index % 3 === 0 ? 'Female' : index % 3 === 1 ? 'Male' : 'Other',
      classes[index % classes.length], departments[index % departments.length], `+91 98000 ${String(10000 + index).slice(-5)}`
    ).lastInsertRowid;
    const parent = insertParent.run(
      `${last} Family`, `+91 97000 ${String(20000 + index).slice(-5)}`, `parent${index + 1}@example.com`
    ).lastInsertRowid;
    insertLink.run(student, parent, index % 3 === 0 ? 'Mother' : index % 3 === 1 ? 'Father' : 'Guardian');
    if (index % 5 === 0) {
      const secondParent = insertParent.run(`${last} Guardian`, `+91 97100 ${String(20000 + index).slice(-5)}`, `guardian${index + 1}@example.com`).lastInsertRowid;
      insertLink.run(student, secondParent, 'Guardian');
    }

    if (random() < 0.85) {
      const illness = pick(illnesses);
      insertHealth.run(student, date(3 + Math.floor(random() * 120)), illness[0], illness[1], illness[2]);
    }
    if (random() < 0.7) {
      const severity = pick(['Low', 'Low', 'Medium', 'High', 'Critical']);
      insertIncident.run(student, date(5 + Math.floor(random() * 150)), pick(locations), pick(incidentTypes), severity, 'Record for dashboard and workflow testing.', pick(staff));
    }
    if (random() < 0.6) {
      const status = pick(['Open', 'Under Review', 'Resolved', 'Closed']);
      insertDiscipline.run(student, date(8 + Math.floor(random() * 180)), pick(violations), status === 'Open' ? 'Counseling session scheduled' : 'Follow-up completed', status);
    }
    if (random() < 0.45) {
      insertAlert.run(student, pick(staff), pick(alertTypes), dateTime(Math.floor(random() * 30)), pick(['Unread', 'Acknowledged', 'Resolved']));
    }
  });
  db.exec('COMMIT');
  console.log(`Seeded ${names.length} students with related parents, staff, health, safety, discipline, and alert data.`);
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
