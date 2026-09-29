const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check for Railway
app.get('/health', (_req, res) => res.json({ ok: true }));

// Admin area placeholder: the Kingdom Publications CRM will mount here
app.get('/admin', (_req, res) => {
  res
    .type('html')
    .send('<!doctype html><html><head><meta charset="utf-8"><title>Kingdom Publications Admin</title></head><body style="font-family:Georgia,serif;background:#0A0805;color:#EFE6D0;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#D9B45B;font-weight:500">Kingdom Publications Admin</h1><p>CRM coming soon.</p></div></body></html>');
});

// Static site
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

app.listen(PORT, () => console.log(`Cosmic Court site running on port ${PORT}`));
