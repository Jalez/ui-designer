'use client';

import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import CodeEditor from "./CodeEditor/CodeEditor";
import { Lock, LockOpen, Menu } from "lucide-react";
import { handleLocking } from "@/store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { cn } from "@/lib/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/apiUrl";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { TabPresence } from "@/components/collaboration/TabPresence";
import { ActiveUser, EditorType } from "@/lib/collaboration/types";
import { logDebugClient } from "@/lib/debug-logger";
import { useCreatorAiChatStore } from "@/components/creator-ai/store";
import { serializeLevelForPersistence } from "@/lib/levels/variants";

interface LanguageData {
  code: string;
  solution: string;
  locked: boolean;
}

interface EditorTabsProps {
  languages: {
    html: LanguageData;
    css: LanguageData;
    js: LanguageData;
  };
  codeUpdater: (language: 'html' | 'css' | 'js', code: string, isSolution: boolean) => void;
  identifier: string;
}

const EMPTY_ACTIVE_USERS: ActiveUser[] = [];
function EditorTabs({
  languages,
  codeUpdater,
  identifier,
}: EditorTabsProps) {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();

  const [activeLanguage, setActiveLanguage] = React.useState<'html' | 'css' | 'js'>('html');
  const [isTemplateMode, setIsTemplateMode] = React.useState<boolean>(true);
  const [useCompactHeader, setUseCompactHeader] = React.useState(false);
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const setActiveEditorContext = useCreatorAiChatStore((state) => state.setActiveEditorContext);

  const collaboration = useOptionalCollaboration();
  const isConnected = collaboration?.isConnected ?? false;
  const activeUsers = collaboration?.activeUsers ?? EMPTY_ACTIVE_USERS;
  const myClientId = collaboration?.clientId ?? null;
  const otherUsersByTab = React.useMemo(() => {
    const currentLevelIndex = currentLevel - 1;
    const emptyUsers = { html: [] as typeof activeUsers, css: [] as typeof activeUsers, js: [] as typeof activeUsers };
    if (!myClientId) return emptyUsers;

    const usersOnCurrentLevel = activeUsers.filter(
      (u) => u.clientId !== myClientId && u.activeLevelIndex === currentLevelIndex
    );

    return {
      html: usersOnCurrentLevel.filter((u) => u.activeTab === "html"),
      css: usersOnCurrentLevel.filter((u) => u.activeTab === "css"),
      js: usersOnCurrentLevel.filter((u) => u.activeTab === "js"),
    };
  }, [activeUsers, currentLevel, myClientId]);
  const setActiveTab = collaboration?.setActiveTab;
  const lastSentTabRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isConnected || !setActiveTab) return;
    const nextPresenceKey = `${currentLevel - 1}:${activeLanguage}`;
    if (lastSentTabRef.current === nextPresenceKey) return;
    lastSentTabRef.current = nextPresenceKey;
    setActiveTab(activeLanguage, currentLevel - 1);
  }, [currentLevel, isConnected, setActiveTab, activeLanguage]);

  React.useEffect(() => {
    if (!isCreator) {
      return;
    }
    setActiveEditorContext(activeLanguage, isTemplateMode ? "template" : "solution");
  }, [activeLanguage, isCreator, isTemplateMode, setActiveEditorContext]);

  React.useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeaderMode = (width: number) => {
      const compactThreshold = isCreator ? 450 : 250;
      setUseCompactHeader(width < compactThreshold);
    };

    updateHeaderMode(header.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateHeaderMode(entry.contentRect.width);
    });

    observer.observe(header);
    return () => observer.disconnect();
  }, [isCreator]);

  const handleLanguageChange = (newLanguage: string) => {
    const editorType = newLanguage as EditorType;
    setActiveLanguage(editorType);
    if (isConnected && setActiveTab) {
      lastSentTabRef.current = `${currentLevel - 1}:${editorType}`;
      setActiveTab(editorType, currentLevel - 1);
    }
  };

  const handleLockUnlock = async (language: 'html' | 'css' | 'js') => {
    dispatch(
      handleLocking({
        levelId: currentLevel,
        type: language,
      })
    );
    const lockKey = `lock${language.toUpperCase()}`;
    syncLevelFields(currentLevel - 1, [lockKey]);

    if (!identifier || !UUID_REGEX.test(identifier)) {
      return;
    }

    const level = levels[currentLevel - 1];
    if (!level) return;

    const nextLocks = {
      lockHTML: language === "html" ? !level.lockHTML : level.lockHTML,
      lockCSS: language === "css" ? !level.lockCSS : level.lockCSS,
      lockJS: language === "js" ? !level.lockJS : level.lockJS,
    };
    logDebugClient("lock_toggle_click", {
      levelIndex: currentLevel - 1,
      language,
      identifier,
      roomId: collaboration?.roomId ?? null,
      groupId: collaboration?.groupId ?? null,
      nextLocks,
      href: typeof window !== "undefined" ? window.location.href : null,
    });

    try {
      const serializedLevel = serializeLevelForPersistence({
        ...level,
        ...nextLocks,
      });
      const { name, ...json } = serializedLevel;
      const response = await fetch(apiUrl(`/api/levels/${identifier}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...json }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to persist editor locks:", errorText);
      }
    } catch (error) {
      console.error("Failed to persist editor locks:", error);
    }
  };

  const getLanguageLang = (lang: 'html' | 'css' | 'js') => {
    switch (lang) {
      case 'html':
        return html();
      case 'css':
        return css();
      case 'js':
        return javascript();
      default:
        return html();
    }
  };

  const getLanguageTitle = (lang: 'html' | 'css' | 'js'): "HTML" | "CSS" | "JS" => {
    switch (lang) {
      case 'html':
        return 'HTML';
      case 'css':
        return 'CSS';
      case 'js':
        return 'JS';
    }
  };

  const handleCodeUpdate = React.useCallback((data: { html?: string; css?: string; js?: string }, type: string) => {
    const isSolution = type === 'Solution' || type === 'solution';
    const updatedLanguage = (Object.keys(data).find(
      (key) => key === 'html' || key === 'css' || key === 'js'
    ) || activeLanguage) as 'html' | 'css' | 'js';

    const code = data[updatedLanguage];
    if (code !== undefined) {
      codeUpdater(updatedLanguage, code, isSolution);
    }
  }, [activeLanguage, codeUpdater]);

  const languageTabs = [
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'js', label: 'JS' },
  ];

  return (
    <div
      className="flex flex-col justify-start items-stretch m-0 p-0 flex-1 min-h-[300px] h-full w-full relative border border-border/70"
    >
      <div className="flex flex-col justify-start items-stretch m-0 p-0 flex-1 h-full w-full relative ">
        <Tabs value={activeLanguage} onValueChange={handleLanguageChange} className="w-full h-full flex flex-col">
          <div ref={headerRef} className="relative min-h-10 bg-border/20 dark:bg-muted/60">
            <div
              className={cn(
                "absolute inset-0 flex items-center gap-0 transition-opacity duration-150",
                useCompactHeader ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Editor</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {languageTabs.map((tab) => {
                    const tabLanguage = tab.value as 'html' | 'css' | 'js';
                    const tabLocked = languages[tabLanguage].locked;
                    const isActive = activeLanguage === tabLanguage;
                    const tabUsers = otherUsersByTab[tabLanguage] || [];

                    return (
                      <DropdownMenuItem
                        key={tab.value}
                        onClick={() => handleLanguageChange(tab.value)}
                        className={cn(
                          "cursor-pointer flex items-center justify-between",
                          isActive && "bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{tab.label}</span>
                          {isConnected && tabUsers.length > 0 && (
                            <TabPresence users={tabUsers} size="sm" />
                          )}
                        </div>
                        {isCreator && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleLockUnlock(tabLanguage);
                            }}
                            title={tabLocked ? "Unlock" : "Lock"}
                          >
                            {tabLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                          </Button>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex flex-1 items-center justify-between gap-2 px-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-primary truncate">
                    {languageTabs.find(tab => tab.value === activeLanguage)?.label}
                  </span>
                  {isConnected && (otherUsersByTab[activeLanguage] || []).length > 0 && (
                    <TabPresence users={otherUsersByTab[activeLanguage]} size="sm" />
                  )}
                </div>
                {isCreator && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Template</span>
                    <Switch
                      checked={!isTemplateMode}
                      onCheckedChange={(checked) => setIsTemplateMode(!checked)}
                      aria-label="Toggle between template and solution"
                    />
                    <span className="text-xs text-muted-foreground">Solution</span>
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                "absolute inset-0 flex items-center gap-0 transition-opacity duration-150",
                useCompactHeader ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
              )}
            >
              <TabsList className="flex flex-1 gap-0 bg-transparent">
                {languageTabs.map((tab) => {
                  const tabLanguage = tab.value as 'html' | 'css' | 'js';
                  const tabLocked = languages[tabLanguage].locked;
                  const isActive = activeLanguage === tabLanguage;
                  const tabUsers = otherUsersByTab[tabLanguage] || [];

                  return (
                    <div
                      key={tab.value}
                      className={cn(
                        "flex items-center h-full",
                        isActive ? "bg-secondary" : "bg-border/20 dark:bg-muted/60"
                      )}
                    >
                      <TabsTrigger
                        value={tab.value}
                        className="text-primary flex items-center gap-1.5 border-0 h-full"
                      >
                        <span>{tab.label}</span>
                        {isConnected && tabUsers.length > 0 && (
                          <TabPresence users={tabUsers} size="sm" />
                        )}
                      </TabsTrigger>
                      {isCreator && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-full w-6 p-0 px-2 flex items-center justify-center relative z-10 rounded-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleLockUnlock(tabLanguage);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          title={tabLocked ? "Unlock" : "Lock"}
                        >
                          {tabLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </TabsList>

              {isCreator && (
                <div className="flex items-center gap-2 px-2">
                  <span className="text-sm text-muted-foreground">Template</span>
                  <Switch
                    checked={!isTemplateMode}
                    onCheckedChange={(checked) => setIsTemplateMode(!checked)}
                    aria-label="Toggle between template and solution"
                  />
                  <span className="text-sm text-muted-foreground">Solution</span>
                </div>
              )}
            </div>
          </div>
          {languageTabs.map((tab) => {
            const langData = languages[tab.value as 'html' | 'css' | 'js'];
            const code = isTemplateMode ? langData.code : langData.solution;
            const locked = langData.locked;

            return (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="flex-1 flex flex-col min-h-0 mt-0"
              >
                <CodeEditor
                  key={`${tab.value}-${isTemplateMode ? "template" : "solution"}-${currentLevel}-${identifier}`}
                  lang={getLanguageLang(tab.value as 'html' | 'css' | 'js')}
                  title={getLanguageTitle(tab.value as 'html' | 'css' | 'js')}
                  codeUpdater={handleCodeUpdate}
                  template={code}
                  levelIdentifier={identifier}
                  locked={locked}
                  type={isTemplateMode ? 'Template' : 'Solution'}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}

export default EditorTabs;
