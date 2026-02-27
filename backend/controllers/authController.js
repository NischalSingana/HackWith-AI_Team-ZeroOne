const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// In production, this should be a secure environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fir_key_for_development_purposes_only';

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        // 1. Find user in the db
        const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (userRes.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        const user = userRes.rows[0];

        // 2. Validate password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        // 3. Generate JWT Token
        // Includes payload data (id, username, role) and expires in 24 hours.
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ [Auth Controller] Server Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
