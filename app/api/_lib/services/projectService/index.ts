import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Project, CreateProjectOptions, UpdateProjectOptions } from "./types";

export * from "./types";

// CREATE
export async function createProject(options: CreateProjectOptions): Promise<Project> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    INSERT INTO projects (user_id, map_name, title, progress_data)
    VALUES (
      ${options.userId}, 
      ${options.mapName}, 
      ${options.title}, 
      ${JSON.stringify(options.progressData || {})}
    )
    RETURNING id, user_id, map_name, title, progress_data, created_at, updated_at
  `;

  const rows = extractRows(result);
  
  if (rows.length === 0) {
    throw new Error("Failed to create project");
  }

  return {
    id: rows[0].id,
    user_id: rows[0].user_id,
    map_name: rows[0].map_name,
    title: rows[0].title,
    progress_data: rows[0].progress_data,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}

// READ
export async function getProjectById(id: string, userId: string): Promise<Project | null> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT id, user_id, map_name, title, progress_data, created_at, updated_at
    FROM projects
    WHERE id = ${id} AND user_id = ${userId}
    LIMIT 1
  `;

  const rows = extractRows(result);

  if (rows.length === 0) {
    return null;
  }

  return {
    id: rows[0].id,
    user_id: rows[0].user_id,
    map_name: rows[0].map_name,
    title: rows[0].title,
    progress_data: rows[0].progress_data,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}

export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT id, user_id, map_name, title, progress_data, created_at, updated_at
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  const rows = extractRows(result);

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    map_name: row.map_name,
    title: row.title,
    progress_data: row.progress_data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// UPDATE
export async function updateProject(
  id: string,
  userId: string,
  options: UpdateProjectOptions
): Promise<Project | null> {
  const sqlInstance = await sql();

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (options.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(options.title);
  }

  if (options.progressData !== undefined) {
    updates.push(`progress_data = $${paramIndex++}`);
    values.push(JSON.stringify(options.progressData));
  }

  if (updates.length === 0) {
    return await getProjectById(id, userId);
  }

  values.push(id, userId);

  const result = await sqlInstance.unsafe(
    `UPDATE projects 
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING id, user_id, map_name, title, progress_data, created_at, updated_at`,
    values
  );

  const rows = extractRows(result);

  if (rows.length === 0) {
    return null;
  }

  return {
    id: rows[0].id,
    user_id: rows[0].user_id,
    map_name: rows[0].map_name,
    title: rows[0].title,
    progress_data: rows[0].progress_data,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}

// DELETE
export async function deleteProject(id: string, userId: string): Promise<boolean> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    DELETE FROM projects
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;

  const rows = extractRows(result);

  return rows.length > 0;
}
