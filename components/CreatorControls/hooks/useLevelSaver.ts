'use client';

import { useAppSelector, useAppDispatch } from "@/store/hooks/hooks";
import { levelUrl } from "@/constants";
import { updateLevelIdentifier } from "@/store/slices/levels.slice";

// UUID validation regex: matches standard UUID format (8-4-4-4-12 hexadecimal digits)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (str: string): boolean => {
  return UUID_REGEX.test(str);
};

export const useLevelSaver = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const handleSave = async () => {
    if (!level) {
      alert("No level selected");
      return;
    }

    console.log("level", level);
    
    try {
      // Validate identifier: if it exists, it must be a valid UUID
      // If no identifier, we'll create a new level (POST)
      // If valid UUID, we'll update the existing level (PUT)
      if (level.identifier && !isValidUUID(level.identifier)) {
        throw new Error(
          `Invalid identifier format: "${level.identifier}" is not a valid UUID. ` +
          `The identifier must be a UUID (e.g., "123e4567-e89b-12d3-a456-426614174000"). ` +
          `Remove the identifier to create a new level, or use a valid UUID to update an existing level.`
        );
      }

      const isUpdate = level.identifier && isValidUUID(level.identifier);
      const url = isUpdate ? `${levelUrl}/${level.identifier}` : levelUrl;
      const method = isUpdate ? "PUT" : "POST";

      // Prepare the request body: API expects { name, ...json }
      // where json contains all level properties except name and identifier
      const { identifier, name, ...json } = level;
      const body = {
        name,
        ...json,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          if (errorText) {
            errorMessage += `: ${errorText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        console.log("Level saved successfully:", data);
        
        // If this was a create operation, update the level in Redux with the new UUID identifier
        if (!isUpdate && data.identifier) {
          dispatch(updateLevelIdentifier({
            levelId: currentLevel,
            identifier: data.identifier
          }));
        }
        
        alert(`Level ${isUpdate ? "updated" : "created"} successfully!`);
      } else {
        const text = await response.text();
        console.log("Level saved successfully:", text);
        alert(`Level ${isUpdate ? "updated" : "created"} successfully!`);
      }
    } catch (error) {
      console.error("Error saving level:", error);
      if (error instanceof Error) {
        alert(`Failed to save level: ${error.message}`);
      } else {
        alert("Failed to save level. Please check the console for details.");
      }
    }
  };

  return { handleSave };
};


