const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const routes = require('./routes');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Customized Helmet with CSP for CDNs
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],  // For inline event handlers like onclick
      styleSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],  // For sourcemaps
    },
  },
}));

app.use(compression());
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});