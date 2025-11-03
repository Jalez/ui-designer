'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Delete, Edit, Check } from "lucide-react";
import { useState } from "react";
import {
  removeGuideSectionItem,
  updateGuideSectionItem,
} from "@/store/slices/levels.slice";
const InfoGuideListItem = ({
  item,
  itemLocation,
  sectionLocation,
}: {
  item: string;
  itemLocation: number;
  sectionLocation: number;
}) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const dispatch = useAppDispatch();
  const [listItem, setListItem] = useState(item);
  const [edited, setEdited] = useState(false);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [showEditDelete, setShowEditDelete] = useState(false);

  const handleDelete = () => {
    // dispatch a delete action
    dispatch(
      removeGuideSectionItem({
        levelId: currentLevel,
        itemIndex: itemLocation,
        sectionIndex: sectionLocation,
      })
    );
  };

  const handleClickToEdit = () => {
    setEdited(true);

    // dispatch a select action which makes it editable
  };

  const handleFinishEdit = () => {
    setEdited(false);
    // dispatch a save action
    dispatch(
      updateGuideSectionItem({
        levelId: currentLevel,
        itemIndex: itemLocation,
        sectionIndex: sectionLocation,
        text: listItem,
      })
    );
  };
  // If user is a creator, return a list item that is clickable to edit, and has a delete button to remove it.
  if (isCreator)
    return (
      <li className="flex justify-between items-center">
        {edited ? (
          <>
            <Textarea
              className="bg-primary text-primary max-h-20"
              value={listItem}
              onChange={(e) => setListItem(e.target.value)}
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
            <p className="cursor-pointer">
              {item}
            </p>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleClickToEdit}
                className={showEditDelete ? "visible" : "invisible"}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={showEditDelete ? "visible" : "invisible"}
                onClick={handleDelete}
              >
                <Delete className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}
      </li>
    );

  return <li>{item}</li>;
};

export default InfoGuideListItem;
