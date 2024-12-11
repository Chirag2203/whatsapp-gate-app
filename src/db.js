const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

db = null;

function getDB() {
    if (db != null)
        return db;

    db = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    return db;
}

module.exports = getDB;