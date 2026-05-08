#!/usr/bin/env node
// ===========================================
// BLADEOPS — Database Setup Script
// ===========================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../backend/config/database');

async function setup() {
  console.log('\n🚀 BladeOps — Database Setup\n');

  try {
    // Read and execute schema
    console.log('📋 Creating schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Schema created\n');

    // Read and execute seed
    console.log('🌱 Seeding data...');
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await pool.query(seed);
    console.log('✅ Data seeded\n');

    console.log('🎉 Database setup complete!\n');
    console.log('Default credentials:');
    console.log('  Admin:    admin@bladeops.ao     / Admin@2024!');
    console.log('  Pilot:    c.mendes@bladeops.ao  / Admin@2024!');
    console.log('  Copilot:  j.ferreira@bladeops.ao / Admin@2024!\n');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
