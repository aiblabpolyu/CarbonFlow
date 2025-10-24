const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

const rootDir = __dirname;

app.use(compression());

app.use(express.static(rootDir, {
  maxAge: '1d',
  etag: true,
  index: false
}));

app.get('/healthz', (req, res) => {
  res.type('text/plain').send('ok');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index_improved.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  res.sendFile(path.join(rootDir, 'index_improved.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
