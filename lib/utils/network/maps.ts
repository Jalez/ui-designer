import { mapUrl } from "@/constants";
import { Level, MapDetails } from "@/types";
import { makeRequest } from "./makeRequest";

const url = mapUrl;

type getMapLevels = (mapName: string) => Promise<Level[]>;
type getMapNames = () => Promise<string[]>;
type getMapByName = (name: string) => Promise<MapDetails>;
type createMap = (map: MapDetails) => Promise<MapDetails>;
type updateMap = (name: string, map: MapDetails) => Promise<MapDetails>;
type deleteMap = (name: string) => Promise<MapDetails>;
type getAllMaps = () => Promise<MapDetails[]>;

/**
 * @description Get the levels of a map
 * @param mapName  - the name of the map
 * @returns Promise<Level[]>
 */
export const getMapLevels: getMapLevels = async (mapName) => {
  const url = `${mapUrl}/levels/${mapName}`;
  return makeRequest<Level[]>(url);
};

/**
 * @description Get the names of all maps from the server
 * @returns Promise<string[]>
 */
export const getMapNames: getMapNames = async () => {
  const url = `${mapUrl}/names`;
  return makeRequest<string[]>(url);
};

/**
 * @description Get a map by its name
 * @param {string} name - the name of the map
 * @returns Promise<MapDetails>
 */
export const getMapByName: getMapByName = async (name) => {
  const url = `${mapUrl}/${name}`;
  return makeRequest<MapDetails>(url);
};

/**
 * @description Create a new map
 * @param {MapDetails} map - the map data
 * @returns Promise<MapDetails>
 */
export const createMap: createMap = async (map) => {
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(map),
  };
  return makeRequest<MapDetails>(url, options);
};

/**
 * @description Update a map
 * @param {string} name - the name of the map
 * @param {MapDetails} map - the map data
 * @returns Promise<MapDetails>
 */
export const updateMap: updateMap = async (name, map) => {
  const url = `${mapUrl}/${name}`;
  const options: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(map),
  };
  return makeRequest<MapDetails>(url, options);
};

/**
 * @description Delete a map
 * @param {string} name - the name of the map
 * @returns Promise<MapDetails>
 */
export const deleteMap: deleteMap = async (name) => {
  const url = `${mapUrl}/${name}`;
  const options: RequestInit = {
    method: "DELETE",
  };
  return makeRequest<MapDetails>(url, options);
};

/**
 * @description Get all maps from the server
 * @returns Promise<MapDetails[]>
 */
export const getAllMaps: getAllMaps = async () => {
  return makeRequest<MapDetails[]>(url);
};
