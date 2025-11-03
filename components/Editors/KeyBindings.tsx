'use client';

import { secondaryColor, mainColor } from "@/constants";

export const KeyBindings = (): React.ReactNode => {
  // lists all the keybindings
  return (
    <div
      className="p-4 z-10"
      style={{
        color: mainColor,
        backgroundColor: secondaryColor,
      }}
    >
      <h2 className="text-3xl font-semibold">Hotkeys</h2>
      <ul>
        {/* <li>
          <strong>Ctrl + S</strong> - Save and test the code
        </li> */}
        <li>
          <strong>Ctrl + Z</strong> - Undo the last code change
        </li>
        <li>
          <strong>Ctrl + Y</strong> - Redo the last action
        </li>
        <li>
          <strong>Ctrl + C</strong> - Copy the selected text
        </li>
        <li>
          <strong>Ctrl + X</strong> - Cut the selected text
        </li>
        <li>
          <strong>Ctrl + V</strong> - Paste the copied text
        </li>
        <li>
          <strong>Ctrl + '</strong> - Comment/Uncomment the selected line
        </li>
        <li>
          <strong>Ctrl + L</strong> - Highlight the current line
        </li>
      </ul>
    </div>
  );
};
