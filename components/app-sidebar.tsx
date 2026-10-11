"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Home,
  Settings,
  Plus,
  FileText,
  ChevronRight,
  Trash2,
  Star,
  Sparkles,
  ChevronsUpDown,
  Folder,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Sample navigation data for Notion-style sidebar
const data = {
  navMain: [
    { title: "Search", icon: Search, action: "search" },
    { title: "Home", icon: Home, url: "/dashboard" },
    { title: "Settings", icon: Settings, url: "/dashboard/settings" },
  ],
  favorites: [
    { title: "Personal Notes", emoji: "📝", url: "/dashboard/notes/personal" },
    { title: "Project Roadmap", emoji: "🚀", url: "/dashboard/notes/roadmap" },
  ],
  notebooks: [
    {
      title: "Work Workspace",
      icon: Folder,
      pages: [
        { title: "Meeting Notes", url: "/dashboard/work/meetings" },
        { title: "Q4 Goals", url: "/dashboard/work/goals" },
      ],
    },
    {
      title: "Personal",
      icon: Folder,
      pages: [
        { title: "Daily Journal", url: "/dashboard/personal/journal" },
        { title: "Reading List", url: "/dashboard/personal/reading" },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      {/* 1. Workspace Header / Switcher */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Image
                      src="/logo.png"
                      alt="Orbit Logo"
                      width={40}
                      height={40}
                      className="h-12 w-12 object-contain"
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Orbit Workspace</span>
                    <span className="truncate text-xs text-muted-foreground">Free Plan</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" align="start">
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Sparkles className="size-4" />
                  </div>
                  Upgrade to Pro
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 p-2">
                  <Settings className="size-4" />
                  Workspace Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* 2. Main Content Area */}
      <SidebarContent>
        {/* Quick Links */}
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title}>
                  {item.url ? (
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  ) : (
                    <button>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </button>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Favorites Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            <Star className="size-3.5 text-amber-500" />
            <span>Favorites</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.favorites.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton tooltip={item.title}>
                    <Link href={item.url}>
                      <span className="text-sm">{item.emoji}</span>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Workspace Notebooks (Collapsible Tree) */}
        <SidebarGroup>
          <SidebarGroupLabel>Private Pages</SidebarGroupLabel>
          <SidebarGroupAction title="Add Page">
            <Plus className="size-4" />
            <span className="sr-only">Add Page</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.notebooks.map((notebook) => (
                <Collapsible key={notebook.title} defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger>
                      <SidebarMenuButton tooltip={notebook.title}>
                        <notebook.icon className="size-4" />
                        <span>{notebook.title}</span>
                        <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {notebook.pages.map((page) => (
                          <SidebarMenuSubItem key={page.title}>
                            <SidebarMenuSubButton>
                              <Link href={page.url}>
                                <FileText className="size-3.5 text-muted-foreground" />
                                <span>{page.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* 3. Footer Section */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Trash">
              <Link href="/dashboard/trash">
                <Trash2 className="size-4" />
                <span>Trash</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Edge drag rail for collapsing */}
      <SidebarRail />
    </Sidebar>
  );
}