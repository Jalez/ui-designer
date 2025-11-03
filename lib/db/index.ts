import { Sequelize } from 'sequelize';
import config from '../../config/config.json';
import Level from '../models/level';
import Map from '../models/map';
import UserSession from '../models/userSession';
import debug from 'debug';

const logger = debug('ui_designer:db');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env as keyof typeof config];

// Explicitly require sqlite3 to ensure it's available
let sqlite3: any;
try {
  sqlite3 = require('sqlite3');
} catch (error) {
  console.error('Failed to load sqlite3:', error);
  throw new Error('sqlite3 package is required but not found. Please install it: pnpm add sqlite3');
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  dialectModule: sqlite3,
  storage: dbConfig.storage,
  logging: (msg) => logger(msg),
});

const db = {
  sequelize,
  Sequelize,
  Level: Level(sequelize),
  Map: Map(sequelize),
  UserSession: UserSession(sequelize),
};

// Setup associations
if ((db.Level as any).associate) {
  (db.Level as any).associate(db);
}
if ((db.Map as any).associate) {
  (db.Map as any).associate(db);
}

export default db;

