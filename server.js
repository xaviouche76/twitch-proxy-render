const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware pour parser les données JSON dans les requêtes
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Route pour l'enregistrement des streamers
app.post('/register-streamer', async (req, res) => {
  const { twitch_id, display_name, description, profile_image_url } = req.body;

  if (!twitch_id || !display_name || !description || !profile_image_url) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  try {
    await pool.query(
      `INSERT INTO streamers (twitch_id, display_name, description, profile_image_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (twitch_id) DO UPDATE SET display_name = EXCLUDED.display_name,
                                              description = EXCLUDED.description,
                                              profile_image_url = EXCLUDED.profile_image_url`,
      [twitch_id, display_name, description, profile_image_url]
    );

    res.status(200).json({ message: 'Streamer enregistré avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement', details: err.message });
  }
});

// 🔧 Init de la table streamers si elle n'existe pas (utilisable une seule fois)
app.get('/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streamers (
        id SERIAL PRIMARY KEY,
        twitch_id VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        description TEXT,
        profile_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    res.status(200).send('✅ Table streamers créée (ou déjà existante).');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la table', details: err.message });
  }
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
