/**
 * Entry Point - Express Server Setup
 * -----------------------------------
 * Initializes an Express application with CORS and JSON parsing.
 * Loads route modules and starts the API server.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import route handlers
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(cors());            // Enable Cross-Origin Resource Sharing
app.use(express.json());    // Parse incoming JSON payloads

// API route mappings
app.use('/api/auth', authRoutes);   // User registration and login
app.use('/api/admin', adminRoutes); // Admin-only operations
app.use('/api/user', userRoutes);   // Authenticated user features

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
