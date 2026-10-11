"use client";

import { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface BlockEditorProps {
  initialContent?: any[];
  onChange: (content: any[]) => void;
}

export default function BlockEditor({ initialContent, onChange }: BlockEditorProps) {
  const editor = useCreateBlockNote({
    initialContent: 
      initialContent && initialContent.length > 0 
        ? (initialContent as PartialBlock[]) 
        : undefined,
  });

  return (
    <div className="w-full">
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={() => {
          onChange(editor.document);
        }}
      />
    </div>
  );
}