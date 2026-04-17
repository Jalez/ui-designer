/** @format */
'use client';

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpModal } from "@/components/Help/HelpModal";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import Info, { LevelFooterMenu, TimeFooterMenu } from "../InfoBoard/Info";
import { fetchActiveGameGroupsCached, fetchActiveGameIndividualsCached, fetchGroupDetailsCached } from "@/lib/group-details-client";
import type { ClientActiveIndividualInstance } from "@/lib/group-details-client";
import { HelpCircle, Info as InfoIcon, KeyRound, Loader2, User, Users } from "lucide-react";
import { ActiveGroupInstance, CreatorGroupDetailsDialog } from "@/components/groups/CreatorGroupDetailsDialog";
import { CompactMenuButton } from "@/components/General/CompactMenuButton";
import { stripBasePath } from "@/lib/apiUrl";

function getUniqueMemberNames(memberNames?: string[] | null): string[] {
  if (!Array.isArray(memberNames)) {
    return [];
  }

  return Array.from(new Set(memberNames.map((value) => value.trim()).filter(Boolean)));
}

function formatGroupLabel(group: Pick<ActiveGroupInstance, "name" | "memberNames">): string {
  const memberNames = getUniqueMemberNames(group.memberNames);

  if (memberNames.length === 0) {
    return group.name;
  }

  if (memberNames.length === 1) {
    return memberNames[0];
  }

  if (memberNames.length === 2) {
    return `${memberNames[0]}, ${memberNames[1]}`;
  }

  return `${memberNames[0]}, ${memberNames[1]} +${memberNames.length - 2}`;
}

function formatGroupSecondaryLine(group: Pick<ActiveGroupInstance, "name" | "memberNames">): string {
  const primaryLabel = formatGroupLabel(group).trim();
  const groupName = group.name.trim();

  if (!groupName || groupName === primaryLabel) {
    return "Shared group instance";
  }

  return groupName;
}

function useRelativeTime(timestamp: number | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!timestamp) {
      return undefined;
    }

    const update = () => {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 10) setLabel("just now");
      else if (seconds < 60) setLabel(`${seconds}s ago`);
      else setLabel(`${Math.floor(seconds / 60)}m ago`);
    };

    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [timestamp]);

  return timestamp ? label : null;
}

function CreatorGroupsMenu({
  groups,
  isLoading,
  currentGroupId,
  onOpenGroup,
  onOpenDetails,
}: {
  groups: ActiveGroupInstance[];
  isLoading: boolean;
  currentGroupId: string | null;
  onOpenGroup: (groupId: string) => void;
  onOpenDetails: (group: ActiveGroupInstance) => void;
}) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>Active Group Instances</span>
      </div>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-md bg-background/80 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading active groups...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-md bg-background/80 px-3 py-3 text-sm text-muted-foreground">
            No group instances yet
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.groupId}
              className="flex items-center justify-between rounded-md bg-background/80 px-3 py-3"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpenGroup(group.groupId)}
              >
                <div className="truncate text-sm font-semibold text-foreground">
                  {formatGroupLabel(group)}
                  {group.groupId === currentGroupId ? " (Current)" : ""}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatGroupSecondaryLine(group)}
                </div>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-3 h-8 w-8 shrink-0"
                onClick={() => onOpenDetails(group)}
              >
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreatorIndividualsMenu({
  individuals,
  isLoading,
  currentUserId,
  onOpenInstance,
}: {
  individuals: ClientActiveIndividualInstance[];
  isLoading: boolean;
  currentUserId: string | null;
  onOpenInstance: (userId: string) => void;
}) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        <span>Active Individual Instances</span>
      </div>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-md bg-background/80 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading instances...</span>
          </div>
        ) : individuals.length === 0 ? (
          <div className="rounded-md bg-background/80 px-3 py-3 text-sm text-muted-foreground">
            No individual instances yet
          </div>
        ) : (
          individuals.map((individual) => (
            <button
              key={individual.userId}
              type="button"
              className="flex w-full items-center rounded-md bg-background/80 px-3 py-3 text-left"
              onClick={() => onOpenInstance(individual.userId)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">
                  {individual.displayName || individual.userEmail || individual.userId}
                  {individual.userId === currentUserId ? " (Current)" : ""}
                </div>
                {individual.userEmail && individual.displayName && individual.displayName !== individual.userEmail && (
                  <div className="truncate text-xs text-muted-foreground">
                    {individual.userEmail}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export const Footer = () => {
  const options = useAppSelector((state) => state.options);
  const lastSavedLabel = useRelativeTime(options.lastSaved);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const currentGame = useGameStore((state) => {
    if (!state.currentGameId) {
      return null;
    }

    return state.games.find((candidate) => candidate.id === state.currentGameId) ?? null;
  });
  const isCurrentGameResolved = currentGame?.id != null;
  const groupId = searchParams.get("groupId");

  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupJoinKey, setGroupJoinKey] = useState<string | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  const [activeGroups, setActiveGroups] = useState<ActiveGroupInstance[]>([]);
  const [isLoadingActiveGroups, setIsLoadingActiveGroups] = useState(false);
  const [detailsGroup, setDetailsGroup] = useState<ActiveGroupInstance | null>(null);
  const [activeIndividuals, setActiveIndividuals] = useState<ClientActiveIndividualInstance[]>([]);
  const [isLoadingActiveIndividuals, setIsLoadingActiveIndividuals] = useState(false);

  /** Matches Tailwind `xl:` (1280px); footer layout switches between compact and wide rows. */
  const [isXl, setIsXl] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setIsXl(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const footerTourSpot = (spot: string, when: boolean) => (when ? { "data-tour-spot": spot } : {});

  const viewUserId = searchParams.get("userId");
  const isGroupGameplay = currentGame?.collaborationMode === "group" && Boolean(groupId);
  const showCreatorGroupInstances =
    currentGame?.collaborationMode === "group" &&
    Boolean(currentGame?.id) &&
    Boolean(currentGame?.canEdit ?? currentGame?.isOwner) &&
    normalizedPathname.startsWith("/game/") &&
    options.mode !== "creator";
  const showCreatorIndividualInstances =
    currentGame?.collaborationMode === "individual" &&
    Boolean(currentGame?.id) &&
    Boolean(currentGame?.canEdit ?? currentGame?.isOwner) &&
    normalizedPathname.startsWith("/game/") &&
    options.mode !== "creator";

  useEffect(() => {
    if (!isGroupGameplay || !groupId || !isCurrentGameResolved) {
      setGroupName(null);
      setGroupJoinKey(null);
      setIsLoadingGroup(false);
      return;
    }

    let cancelled = false;

    const loadGroupDetails = async () => {
      try {
        setIsLoadingGroup(true);
        const data = await fetchGroupDetailsCached(groupId, {
          gameId: currentGame?.id,
          preferCreatorAccess: showCreatorGroupInstances,
        });
        if (!cancelled) {
          setGroupName(data.group?.name ?? null);
          setGroupJoinKey(data.group?.joinKey ?? null);
        }
      } catch {
        if (!cancelled) {
          setGroupName(null);
          setGroupJoinKey(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingGroup(false);
        }
      }
    };

    loadGroupDetails();
    return () => {
      cancelled = true;
    };
  }, [currentGame?.id, groupId, isCurrentGameResolved, isGroupGameplay, showCreatorGroupInstances]);

  useEffect(() => {
    if (!showCreatorGroupInstances || !currentGame?.id) {
      setActiveGroups([]);
      setIsLoadingActiveGroups(false);
      return;
    }

    let cancelled = false;

    const loadActiveGroups = async () => {
      try {
        setIsLoadingActiveGroups(true);
        const groups = await fetchActiveGameGroupsCached(currentGame.id);
        if (!cancelled) {
          setActiveGroups(groups as ActiveGroupInstance[]);
        }
      } catch {
        if (!cancelled) {
          setActiveGroups([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingActiveGroups(false);
        }
      }
    };

    loadActiveGroups();
    return () => {
      cancelled = true;
    };
  }, [currentGame?.id, showCreatorGroupInstances]);

  useEffect(() => {
    if (!showCreatorIndividualInstances || !currentGame?.id) {
      setActiveIndividuals([]);
      setIsLoadingActiveIndividuals(false);
      return;
    }

    let cancelled = false;

    const loadActiveIndividuals = async () => {
      try {
        setIsLoadingActiveIndividuals(true);
        const individuals = await fetchActiveGameIndividualsCached(currentGame.id);
        if (!cancelled) {
          setActiveIndividuals(individuals);
        }
      } catch {
        if (!cancelled) {
          setActiveIndividuals([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingActiveIndividuals(false);
        }
      }
    };

    loadActiveIndividuals();
    return () => {
      cancelled = true;
    };
  }, [currentGame?.id, showCreatorIndividualInstances]);

  const openGroupInstance = (nextGroupId: string) => {
    if (!currentGame?.id) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.set("groupId", nextGroupId);
    router.push(`/game/${currentGame.id}?${params.toString()}`);
  };

  const openIndividualInstance = (targetUserId: string) => {
    if (!currentGame?.id) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.set("userId", targetUserId);
    params.delete("groupId");
    router.push(`/game/${currentGame.id}?${params.toString()}`);
  };

  return (
    <footer className="w-full h-fit shrink-0 border-t p-2 text-sm">
      <div className="flex items-center gap-2 xl:hidden">
        <div className="flex flex-1 min-w-0" {...footerTourSpot("footer.help", !isXl)}>
          <HelpModal
            mode={options.mode === "creator" ? "creator" : "game"}
            trigger={
              <CompactMenuButton icon={HelpCircle} label="Help" text="Help" />
            }
          />
        </div>
        <div className="flex flex-1 min-w-0" {...footerTourSpot("footer.level_menu", !isXl)}>
          <LevelFooterMenu />
        </div>
        <div
          className="flex flex-1 min-w-0"
          {...footerTourSpot("footer.time_menu", !isXl && options.mode !== "creator")}
        >
          <TimeFooterMenu />
        </div>
        {showCreatorGroupInstances || showCreatorIndividualInstances || (isGroupGameplay && groupId) ? (
          <div
            className="flex flex-1 min-w-0"
            {...footerTourSpot("footer.collaboration", !isXl)}
          >
            {showCreatorGroupInstances ? (
              <Popover>
                <PopoverTrigger asChild>
                  <CompactMenuButton
                    icon={isLoadingActiveGroups ? Loader2 : Users}
                    label="Groups"
                    text="Groups"
                    className={isLoadingActiveGroups ? "[&_svg]:animate-spin" : undefined}
                  />
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-80 space-y-3">
                  <CreatorGroupsMenu
                    groups={activeGroups}
                    isLoading={isLoadingActiveGroups}
                    currentGroupId={groupId}
                    onOpenGroup={openGroupInstance}
                    onOpenDetails={setDetailsGroup}
                  />
                </PopoverContent>
              </Popover>
            ) : showCreatorIndividualInstances ? (
              <Popover>
                <PopoverTrigger asChild>
                  <CompactMenuButton
                    icon={isLoadingActiveIndividuals ? Loader2 : User}
                    label="Students"
                    text="Students"
                    className={isLoadingActiveIndividuals ? "[&_svg]:animate-spin" : undefined}
                  />
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-80 space-y-3">
                  <CreatorIndividualsMenu
                    individuals={activeIndividuals}
                    isLoading={isLoadingActiveIndividuals}
                    currentUserId={viewUserId}
                    onOpenInstance={openIndividualInstance}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <CompactMenuButton
                    icon={isLoadingGroup ? Loader2 : Users}
                    label="Group"
                    text={groupName || "Group"}
                    className={isLoadingGroup ? "[&_svg]:animate-spin" : undefined}
                  />
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-72 space-y-3">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>Group Game</span>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold text-foreground">{groupName || "Unnamed group"}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Join Key</span>
                    </div>
                    <p className="mt-2 rounded-sm bg-background/80 px-2 py-1 font-mono text-lg tracking-[0.2em]">
                      {groupJoinKey || "Unavailable"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Share this key with teammates if they need to join the same group.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      <div className="hidden xl:flex items-center gap-2">
        <div
          className="flex flex-1 min-w-0 items-center pointer-events-auto"
          {...footerTourSpot("footer.help", isXl)}
        >
          <HelpModal
            mode={options.mode === "creator" ? "creator" : "game"}
            trigger={
              <CompactMenuButton icon={HelpCircle} label="Help" text="Help" showText="always" />
            }
          />
        </div>
        <div
          className="flex flex-[2] min-w-0 justify-center"
          {...footerTourSpot("footer.info", isXl)}
        >
          <Info />
        </div>
        <div className="flex flex-1 min-w-0 items-center justify-end gap-0">
          {showCreatorGroupInstances || showCreatorIndividualInstances || (isGroupGameplay && groupId) ? (
            <div className="flex items-center gap-2" {...footerTourSpot("footer.collaboration", isXl)}>
              {showCreatorGroupInstances ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <CompactMenuButton
                      icon={isLoadingActiveGroups ? Loader2 : Users}
                      label="Groups"
                      text="Groups"
                      showText="always"
                      className={isLoadingActiveGroups ? "[&_svg]:animate-spin" : undefined}
                    />
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-80 space-y-3">
                    <CreatorGroupsMenu
                      groups={activeGroups}
                      isLoading={isLoadingActiveGroups}
                      currentGroupId={groupId}
                      onOpenGroup={openGroupInstance}
                      onOpenDetails={setDetailsGroup}
                    />
                  </PopoverContent>
                </Popover>
              ) : showCreatorIndividualInstances ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <CompactMenuButton
                      icon={isLoadingActiveIndividuals ? Loader2 : User}
                      label="Students"
                      text="Students"
                      showText="always"
                      className={isLoadingActiveIndividuals ? "[&_svg]:animate-spin" : undefined}
                    />
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-80 space-y-3">
                    <CreatorIndividualsMenu
                      individuals={activeIndividuals}
                      isLoading={isLoadingActiveIndividuals}
                      currentUserId={viewUserId}
                      onOpenInstance={openIndividualInstance}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <CompactMenuButton
                      icon={isLoadingGroup ? Loader2 : Users}
                      label="Group"
                      text={groupName || "Group"}
                      showText="always"
                      className={isLoadingGroup ? "[&_svg]:animate-spin" : undefined}
                    />
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-72 space-y-3">
                    <div className="rounded-md border bg-muted/40 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>Group Game</span>
                      </div>
                      <p className="mt-2 break-words text-sm font-semibold text-foreground">{groupName || "Unnamed group"}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Join Key</span>
                      </div>
                      <p className="mt-2 rounded-sm bg-background/80 px-2 py-1 font-mono text-lg tracking-[0.2em]">
                        {groupJoinKey || "Unavailable"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Share this key with teammates if they need to join the same group.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ) : null}
          {options.mode === "creator" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {options.isSavingLevel ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <span>{lastSavedLabel ? `Saved ${lastSavedLabel}` : "Unsaved"}</span>
              )}
            </span>
          )}
        </div>
      </div>

      <CreatorGroupDetailsDialog
        gameId={currentGame?.id ?? ""}
        group={detailsGroup}
        open={Boolean(detailsGroup)}
        onOpenChange={(open) => !open && setDetailsGroup(null)}
      />
    </footer>
  );
};
