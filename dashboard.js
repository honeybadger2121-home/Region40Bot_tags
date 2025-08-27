const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const db = new sqlite3.Database('./onboarding.db');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  db.all(`SELECT * FROM profiles`, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Database error occurred');
    }
    
    const total = rows?.length || 0;
    const verified = rows?.filter(r => r.verified)?.length || 0;
    const profiled = rows?.filter(r => r.inGameName && r.timezone && r.language)?.length || 0;
    const withAlliance = rows?.filter(r => r.alliance)?.length || 0;
    const recent = (rows || []).slice(-10).reverse();

    const allianceCounts = {};
    (rows || []).forEach(r => {
      if (r.alliance) {
        allianceCounts[r.alliance] = (allianceCounts[r.alliance] || 0) + 1;
      }
    });

    res.render('dashboard', {
      total,
      verified,
      profiled,
      withAlliance,
      recent,
      allianceCounts
    });
  });
});

app.listen(3000, () => console.log('📊 Dashboard running at http://localhost:3000'));

// Add auto-refresh interval
setInterval(() => {
  db.all(`SELECT * FROM profiles`, [], (err, rows) => {
    // You can log stats, cache them, or trigger alerts here
    console.log(`[${new Date().toLocaleTimeString()}] Dashboard refreshed`);
  });
}, 3600000); // 1 hour in milliseconds
