'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create or alter users table to add credit-related columns
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        user_email TEXT UNIQUE NOT NULL,
        user_name TEXT,
        current_credits INTEGER DEFAULT 0,
        plan_name TEXT,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        stripe_monthly_price_id TEXT,
        is_admin INTEGER DEFAULT 0,
        admin_granted_at TEXT,
        admin_granted_by TEXT,
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_settings table
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        setting_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE(user_id, setting_key)
      );
    `);

    // Create credit_history table
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS credit_history (
        history_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT,
        service_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS credit_history;');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS user_settings;');
    // Note: We don't drop users table as it might be used by other parts of the app
  }
};







