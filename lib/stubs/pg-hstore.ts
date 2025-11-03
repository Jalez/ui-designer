// Stub for pg-hstore - we don't use PostgreSQL, only SQLite
// This module is required by Sequelize but we only use SQLite
// Sequelize uses require() so we need CommonJS format
module.exports = function(options?: { sanitize?: boolean }) {
  return {
    stringify: (data: any) => data ? '' : null,
    parse: (value: string) => ({}),
  };
};

