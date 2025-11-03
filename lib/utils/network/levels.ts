import { levelUrl } from "@/constants";
import { Level, LevelIdAndName } from "@/types";
import { makeRequest } from "./makeRequest";

type getLevelNames = () => Promise<LevelIdAndName[]>;
type getLevelById = (id: string) => Promise<Level>;
type updateLevel = (id: string, level: any) => Promise<Level>;
type deleteLevel = (id: string) => Promise<Level>;
type getAllLevels = () => Promise<Level[]>;
type createLevel = (level: any) => Promise<Level>;

/**
 * @description Get the names of all levels from the server
 * @returns Promise<string[]>
 */
export const getLevelNames: getLevelNames = async () => {
  const url = `${levelUrl}/names`;
  const data = makeRequest<LevelIdAndName[]>(url);
  return data;
};

/**
 * @description Get a level by its id
 * @param {string} id - the id of the level
 * @returns Promise<Level>
 */
export const getLevelById: getLevelById = async (id: string) => {
  const url = `${levelUrl}/${id}`;
  const data = makeRequest<Level>(url);
  return data;
};

/**
 * @description Update a level
 * @param {string} id - the id of the level
 * @param {any} level - the level data
 * @returns Promise<Level>
 */
export const updateLevel: updateLevel = async (id, level) => {
  const options: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(level),
  };
  const data = makeRequest<Level>(`${levelUrl}/${id}`, options);
  return data;
};

/**
 * @description Delete a level
 * @param {string} id - the id of the level
 * @returns Promise<Level>
 */
export const deleteLevel: deleteLevel = async (id) => {
  const options: RequestInit = {
    method: "DELETE",
  };
  const data = makeRequest<Level>(`${levelUrl}/${id}`, options);
  return data;
};

/**
 * @description Get all levels from the server
 * @returns Promise<Level[]>
 */
export const getAllLevels: getAllLevels = async () => {
  const data = makeRequest<Level[]>(levelUrl);
  return data;
};

/**
 * @description Create a new level
 * @param {any} level - the level data
 * @returns Promise<Level>
 */
export const createLevel: createLevel = async (level) => {
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(level),
  };
  const data = makeRequest<Level>(levelUrl, options);
  return data;
};
