import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Level, UpdateLevelOptions } from "./types";
import debug from 'debug';

const logger = debug('ui_designer:service:levelService:update');

/**
 * Update a level by identifier
 */
export async function updateLevel(
  identifier: string,
  options: UpdateLevelOptions
): Promise<Level | null> {
  try {
    // Validate identifier
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('Invalid identifier: must be a non-empty string');
    }

    // Validate name if provided
    if (options.name !== undefined) {
      if (typeof options.name !== 'string' || options.name.trim() === '') {
        throw new Error('Invalid name: must be a non-empty string');
      }
    }

    // Validate json if provided
    if (options.json !== undefined) {
      if (options.json === null) {
        throw new Error('Invalid json: cannot be null');
      }
      if (typeof options.json !== 'object') {
        throw new Error(`Invalid json: must be an object, got ${typeof options.json}`);
      }
      
      // Check for circular references by attempting to stringify
      try {
        JSON.stringify(options.json);
      } catch (stringifyError: any) {
        if (stringifyError.message.includes('circular')) {
          throw new Error('Invalid json: contains circular references');
        }
        throw new Error(`Invalid json: failed to stringify - ${stringifyError.message}`);
      }
    }

    const sqlInstance = await sql();

    // Build update query dynamically based on provided options
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(options.name);
    }

    if (options.json !== undefined) {
      // Cast to JSONB in the query to ensure PostgreSQL treats it as JSONB type
      updates.push(`json = $${paramIndex++}::jsonb`);
      let jsonString: string;
      try {
        jsonString = JSON.stringify(options.json);
      } catch (stringifyError: any) {
        logger('Failed to stringify json: %O', stringifyError);
        throw new Error(`Failed to stringify json: ${stringifyError.message}`);
      }
      values.push(jsonString);
    }

    if (updates.length === 0) {
      // No updates provided, just return the current level
      logger('No updates provided, fetching current level for identifier: %s', identifier);
      const result = await sqlInstance`
        SELECT identifier, name, json, created_at, updated_at
        FROM levels
        WHERE identifier = ${identifier}
        LIMIT 1
      `;
      
      const rows = extractRows(result);
      return rows.length > 0 ? {
        identifier: rows[0].identifier,
        name: rows[0].name,
        json: rows[0].json,
        created_at: rows[0].created_at,
        updated_at: rows[0].updated_at,
      } : null;
    }

    values.push(identifier);

    logger('Executing UPDATE query for identifier: %s, updates: %s', identifier, updates.join(', '));

    let result;
    try {
      const query = `UPDATE levels 
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE identifier = $${paramIndex}
         RETURNING identifier, name, json, created_at, updated_at`;
      
      logger('Executing SQL query: %s', query);
      logger('With values: %O', values.map((v, i) => 
        i === values.length - 1 ? v : (typeof v === 'string' && v.length > 100 ? `${v.substring(0, 100)}...` : v)
      ));
      
      result = await sqlInstance.unsafe(query, values);
    } catch (sqlError: any) {
      // Log to both debug logger and console for visibility
      logger('SQL error during UPDATE: %O', sqlError);
      logger('SQL error message: %s', sqlError.message);
      logger('SQL error code: %s', sqlError.code);
      logger('SQL error detail: %s', sqlError.detail);
      
      console.error('[updateLevel] SQL error:', {
        identifier,
        error: sqlError,
        message: sqlError?.message,
        code: sqlError?.code,
        detail: sqlError?.detail,
        query: `UPDATE levels SET ${updates.join(", ")}, updated_at = NOW() WHERE identifier = $${paramIndex} RETURNING ...`
      });
      
      throw new Error(`Database error: ${sqlError.message || 'Unknown SQL error'}`);
    }

    const rows = extractRows(result);

    if (rows.length === 0) {
      logger('UPDATE query returned no rows for identifier: %s', identifier);
      return null;
    }

    logger('Successfully updated level with identifier: %s', identifier);

    return {
      identifier: rows[0].identifier,
      name: rows[0].name,
      json: rows[0].json,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
    };
  } catch (error: any) {
    logger('Error in updateLevel: %O', error);
    logger('Error stack: %s', error.stack);
    // Re-throw the error so it can be caught by the route handler
    throw error;
  }
}
