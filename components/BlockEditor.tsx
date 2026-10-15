"use client";

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
  PartialBlock,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { Table2 } from "lucide-react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { dataTableBlock, DEFAULT_TABLE_DATA } from "./blocks/DataTableBlock";

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    dataTable: dataTableBlock(),
  },
});

interface BlockEditorProps {
  initialContent?: any[];
  onChange: (content: any[]) => void;
}

export default function BlockEditor({ initialContent, onChange }: BlockEditorProps) {
  const editor = useCreateBlockNote({
    schema,
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
        slashMenu={false}
        onChange={() => {
          onChange(editor.document);
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                {
                  title: "Data table",
                  subtext: "Configurable table with typed columns",
                  aliases: ["table", "database", "grid"],
                  group: "Advanced",
                  icon: <Table2 size={18} />,
                  onItemClick: () =>
                    insertOrUpdateBlockForSlashMenu(editor, {
                      type: "dataTable",
                      props: { data: DEFAULT_TABLE_DATA() },
                    }),
                },
              ],
              query
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}
