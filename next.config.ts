import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained build for Docker deployment
  output: "standalone",

  // External packages that should be handled by the server runtime
  serverExternalPackages: ['@neondatabase/serverless', 'pg', 'pg-pool', 'lti-v1.0-node-library'],
  
  // Environment variables to expose to the browser
  env: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  
  // Image domains for external images
  images: {
    domains: ["oaidalleapiprodscus.blob.core.windows.net"], // OpenAI images
  },
  
  webpack: (config, { isServer }) => {
    // Configure webpack fallbacks for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    

    // Ignore database dialects we're not using (but keep pg for PostgreSQL)
    // Use stub files to satisfy require() calls from Sequelize
    const path = require('path');
    const stubPath = path.resolve(__dirname, './lib/stubs/pg-hstore.ts');
    config.resolve.alias = {
      ...config.resolve.alias,
      "pg-hstore": stubPath,
      "mysql2": stubPath,
      "tedious": stubPath,
      "oracledb": stubPath,
    };
    
    // Externalize native modules and database dialects during server-side rendering
    if (isServer) {
      // sqlite3 must be externalized as a native module
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('sqlite3');
      } else {
        config.externals = [config.externals, 'sqlite3'];
      }
      // Also externalize other unused database modules (but keep pg for PostgreSQL)
      config.externals.push({
        "pg-hstore": "commonjs pg-hstore",
        "mysql2": "commonjs mysql2",
        "tedious": "commonjs tedious",
        "oracledb": "commonjs oracledb",
      });
    }
    
    return config;
  },
  // Configure Turbopack to also ignore database modules (but keep pg for PostgreSQL)
  turbopack: {
    resolveAlias: {
      "pg-hstore": "./lib/stubs/pg-hstore.ts",
      "mysql2": "./lib/stubs/pg-hstore.ts",
      "tedious": "./lib/stubs/pg-hstore.ts",
      "oracledb": "./lib/stubs/pg-hstore.ts",
    },
  },
};

export default nextConfig;
