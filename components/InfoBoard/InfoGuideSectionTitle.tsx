'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Edit, Check } from "lucide-react";
import { useState } from "react";
import { updateGuideSectionTitle } from "@/store/slices/levels.slice";
const InfoGuideSectionTitle = ({
  title,
  sectionLocation,
}: {
  title: string;
  sectionLocation: number;
}) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const dispatch = useAppDispatch();
  const [listTitle, setListTitle] = useState(title);
  const [edited, setEdited] = useState(false);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [showEditDelete, setShowEditDelete] = useState(false);

  const handleClickToEdit = () => {
    setEdited(true);

    // dispatch a select action which makes it editable
  };

  const handleFinishEdit = () => {
    setEdited(false);
    // dispatch a save action
    dispatch(
      updateGuideSectionTitle({
        levelId: currentLevel,
        sectionIndex: sectionLocation,
        text: listTitle,
      })
    );
  };
  // If user is a creator, return a list item that is clickable to edit, and has a delete button to remove it.
  if (isCreator)
    return (
      <li className="flex justify-between items-center">
        {edited ? (
          <>
            <Input
              className="text-primary bg-secondary text-2xl"
              value={listTitle}
              onChange={(e) => setListTitle(e.target.value)}
              onBlur={handleFinishEdit}
              autoFocus
            />

            <Button size="icon" variant="ghost" onClick={handleFinishEdit}>
              <Check className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div
            className="flex justify-between items-center w-full"
            //When user hovers over the list item, display the edit and delete buttons
            onMouseEnter={() => setShowEditDelete(true)}
            onMouseLeave={() => setShowEditDelete(false)}
          >
            <h2 className="text-3xl font-semibold">
              {listTitle}
            </h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClickToEdit}
              className={showEditDelete ? "visible" : "invisible"}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        )}
      </li>
    );

  return (
    <h2 className="text-3xl font-semibold">
      {listTitle}
    </h2>
  );
};

export default InfoGuideSectionTitle;
