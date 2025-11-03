'use client';

import { MapDetails } from "@/types";
import { getMapByName } from "@/lib/utils/network/maps";
import { useAppDispatch } from "@/store/hooks/hooks";
import { addNotificationData } from "@/store/slices/notifications.slice";

type MapSelectorProps = {
  handleNameSelect: (mapName: string) => void;
  updateDetails: (map: MapDetails) => void;
  selectedMap: string;
  MapNames: string[];
};

const MapSelector = ({
  handleNameSelect,
  updateDetails,
  selectedMap,
  MapNames,
}: MapSelectorProps) => {
  const dispatch = useAppDispatch();
  const handleMapSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mapName = event.target.value;
    try {
      console.log("mapName", mapName);
      updateDetails(await getMapByName(mapName));
      dispatch(
        addNotificationData({
          message: "Map selected: " + mapName,
          type: "success",
        })
      );
      handleNameSelect(mapName);
    } catch (error: any) {
      dispatch(addNotificationData({ message: error.message, type: "error" }));
    }
  };

  return (
    <div className="flex flex-col gap-4 m-4 p-4 border border-secondary rounded-2xl bg-primary/90">
      <h2 id="edit-prompt-title" className="text-2xl font-semibold">
        Select a map:
      </h2>

      <p id="edit-prompt-description">
        Select a map to edit or delete.
      </p>

      <div className="w-full">
        <label htmlFor="map-names-select" className="block mb-2 text-sm font-medium">
          Map names
        </label>
        <select
          id="map-names-select"
          value={selectedMap}
          onChange={handleMapSelect}
          className="w-full p-2 border border-secondary rounded text-primary bg-background"
        >
          {MapNames.map((map, index) => (
            <option value={map} key={index}>
              {map}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MapSelector;
