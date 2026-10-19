"use client";

import {
  type BlockNoteEditor,
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
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { BarChart3, CalendarCheck, CalendarDays, Clock, Table2 } from "lucide-react";
import { moveCustomBlocksOnDrop } from "./blocks/moveBlockOnDrop";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { dataTableBlock, DEFAULT_TABLE_DATA } from "./blocks/DataTableBlock";
import { habitTrackerBlock, DEFAULT_HABIT_DATA } from "./blocks/HabitTrackerBlock";
import { chartBlock, DEFAULT_CHART_DATA } from "./blocks/ChartBlock";
import { calendarBlock, DEFAULT_CALENDAR_DATA } from "./blocks/CalendarBlock";
import { clockBlock, DEFAULT_CLOCK_DATA } from "./blocks/ClockBlock";

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    dataTable: dataTableBlock(),
    habitTracker: habitTrackerBlock(),
    chart: chartBlock(),
    calendar: calendarBlock(),
    clock: clockBlock(),
  },
});

interface BlockEditorProps {
  editable?: boolean;
  initialContent?: any[];
  onChange: (content: any[]) => void;
  // Hands the live editor to the parent (and null on unmount), e.g. so AI proposals can be applied.
  onEditorReady?: (editor: BlockNoteEditor<any, any, any> | null) => void;
}

export default function BlockEditor({ editable = true, initialContent, onChange, onEditorReady }: BlockEditorProps) {
  const { resolvedTheme } = useTheme();
  const editor = useCreateBlockNote({
    schema,
    initialContent:
      initialContent && initialContent.length > 0
        ? (initialContent as PartialBlock[])
        : undefined,
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;
    // A mount callback firing after cleanup must not leave a listener behind; leaked listeners would each act on drop.
    const register = () => {
      if (!disposed && !cleanup) cleanup = moveCustomBlocksOnDrop(editor);
    };
    if (editor.prosemirrorView) register();
    else editor.onMount(register);
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [editor]);

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div className="w-full">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={resolvedTheme === "light" ? "light" : "dark"}
        slashMenu={false}
        onChange={() => {
          onChange(editor.document);
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const items = getDefaultReactSlashMenuItems(editor);
            const dataTableItem = {
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
            };
            // Menu headings are emitted whenever the group changes between adjacent items, so the
            // item must sit next to the built-in Table item (same group) to avoid a second heading.
            const tableIndex = items.findIndex((i) => (i as { key?: string }).key === "table");
            const habitItem = {
              title: "Habit tracker",
              subtext: "Weekly habit check-ins",
              aliases: ["habit", "habits", "tracker", "routine"],
              group: "Advanced",
              icon: <CalendarCheck size={18} />,
              onItemClick: () =>
                insertOrUpdateBlockForSlashMenu(editor, {
                  type: "habitTracker",
                  props: { data: DEFAULT_HABIT_DATA() },
                }),
            };
            const chartItem = {
              title: "Chart",
              subtext: "Bar, line or pie chart",
              aliases: ["chart", "graph", "bar", "line", "pie"],
              group: "Advanced",
              icon: <BarChart3 size={18} />,
              onItemClick: () =>
                insertOrUpdateBlockForSlashMenu(editor, {
                  type: "chart",
                  props: { data: DEFAULT_CHART_DATA() },
                }),
            };
            const calendarItem = {
              title: "Calendar",
              subtext: "Month calendar with your own events",
              aliases: ["calendar", "month", "events", "schedule"],
              group: "Advanced",
              icon: <CalendarDays size={18} />,
              onItemClick: () =>
                insertOrUpdateBlockForSlashMenu(editor, {
                  type: "calendar",
                  props: { data: DEFAULT_CALENDAR_DATA() },
                }),
            };
            const clockItem = {
              title: "Clock",
              subtext: "Live digital clock",
              aliases: ["clock", "time", "watch"],
              group: "Advanced",
              icon: <Clock size={18} />,
              onItemClick: () =>
                insertOrUpdateBlockForSlashMenu(editor, {
                  type: "clock",
                  props: { data: DEFAULT_CLOCK_DATA() },
                }),
            };
            items.splice(tableIndex === -1 ? items.length : tableIndex + 1, 0, dataTableItem, habitItem, chartItem, calendarItem, clockItem);
            return filterSuggestionItems(items, query);
          }}
        />
      </BlockNoteView>
    </div>
  );
}
