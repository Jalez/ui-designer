'use client';

import { Level, MapDetails } from "@/types";

type MapLevelsProps = {
  selectedMapDetails: MapDetails;
  levels: Level[];
};

const MapLevels = ({ selectedMapDetails, levels }: MapLevelsProps) => {
  return (
    <div>
      <h2 id="edit-prompt-title" className="text-2xl font-semibold mb-2">
        Levels in this map:
      </h2>
      {levels.length > 0 && (
        <ul className="list-disc list-inside">
          {levels.map((level) => (
            <li key={level.identifier}>
              {level.name}
            </li>
          ))}
        </ul>
      )}

      {levels.length === 0 && (
        <p>No levels found in this map, add some.</p>
      )}
    </div>
  );
};

export default MapLevels;
