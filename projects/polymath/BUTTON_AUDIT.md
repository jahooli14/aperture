# Polymath Button Audit

Full sweep of every interactive control in the Polymath app, with expected vs. actual behavior. ~250+ buttons across 8 areas.

Each row: location → label/purpose → expected behavior (click / hold / drag, combined into one column because most controls have only one of these) → actual behavior from reading the code → divergence / UX issue. Rows where actual matches expected are marked `OK`.

---

## Top divergences — priority shortlist

Twelve things that look broken or misleading enough to fix first. Ordered roughly by how bad the user experience is.

1. **BedtimePage Search icon is a dead button.** `BedtimePage.tsx:292` — has hover styling but no `onClick`. Looks clickable, does nothing.
2. **DebugPanel toggle button has no label or icon at all.** `DebugPanel.tsx:62-63` — a 56×56 colored circle with empty content. Almost certainly an emoji that got stripped out.
3. **MemoryDetailModal "connected thought" navigation is broken.** Click navigates to `/memories?highlight=…` but the deep-link effect only listens for `?id=…`. Tapping a bridge closes the modal and silently lands nowhere useful.
4. **Now Consuming row goes to the wrong place.** `HomePage.tsx:107-140` — row visually previews a specific list item, but click routes to the parent list page. No deep-link to the item.
5. **FavouritesPage card opens the list, not the favorited item.** `FavouritesPage.tsx:39-95` — same shape of bug as #4. User expects the specific item.
6. **VoiceFAB JSDoc + dead code disagree with the actual behavior.** Header documents a slide-up strip that no longer exists (`STRIP_OPTIONS` array, `getOptionForDy`, `stripOverlay = null`). The actual contract is "tap = menu, hold = voice" — works, but the code looks like something else.
7. **"Suggest a project" pill does two completely different things.** `ProjectIdeasHome.tsx:388-408` — sometimes a 10s LLM call, sometimes an instant reveal from queue. Same label both times.
8. **CreateMemoryDialog silently auto-saves on close.** Drag, backdrop tap, or X all commit. The "Done" button is redundant and the auto-save is undiscoverable.
9. **"✕ not for me" opens a reason picker instead of dismissing.** `ProjectIdeasHome.tsx:795-806` — icon, label, and `title` all say "dismiss"; behavior is "open submenu." Two-step disguised as one-step.
10. **CompletionRitual destroys typed retro answers on backdrop tap.** `CompletionRitual.tsx:64` — single mis-tap loses thoughtful input.
11. **Drawer pin button can't unpin.** `DrawerPage.tsx:205-221` — aria-label promises "Remove from Up Next," but `setUpNext` only adds. Tapping a pinned project re-pins it.
12. **`focus_cap_reached` swallowed in ProjectsPageCarousel.** `ProjectsPageCarousel.tsx:213-229` — star/priority toggle has no try/catch. Same control in `ProjectCard.tsx` surfaces a toast. Copy the working pattern.

## Cross-cutting patterns

- **Icon-only buttons missing `aria-label` is endemic.** Backdrops in modals, Xs everywhere (CreateMenuModal close, VoiceFAB modal X, VoiceSearch X, PWA banner X, PWAUpdate X, SuggestionToast X, ConnectionPathPicker X, ConnectionRevealOverlay X, ZenMode X/chevrons, MorningFollowUp X, WelcomeModal X, PromptModal X, FocusSession X, EditMemoryDialog image-remove Xs, etc.). The base pattern across the app is `title=` only, which screen readers handle inconsistently.
- **`<div>` / `<motion.div>` used as a button.** Recurring across `GlassCard`, KeepGoingCard hero, BedtimePage prompt card, pinned-thought card on MemoriesPage, ListDetailPage finish-line and task-text rows, ProjectDetailPage blocker post-it. No `role="button"`, no `tabIndex`, no keyboard handler. Keyboard users can't activate any of these.
- **Long-press / swipe behavior is undiscoverable.** ListsPage 500ms long-press for action sheet; ListDetailPage 220ms touch long-press for drag-reorder; ProjectsPageCarousel 450ms long-press for inline action buttons; ProjectCard.tsx 450ms long-press for bottom-sheet menu (different contract from the carousel one!); FocusableList swipe-left to open context sidebar; ReaderPage swipe-right-from-edge to go back; MemoryCard pointer long-press for context menu. None are signposted in the UI.
- **Async handlers with no loading guard, double-clickable.** PWA Install, Voice Search Search, SuggestionToast "Link these", OfflineIndicator Sync now, FixQueue Reject, MorningFollowUp submit, SuggestedPrompts dismiss, FocusSummary "Return to Day", DriftMode Begin Session, settings handoff toggle, list delete (after sheet has closed), and many more.
- **Silent error swallowing in async handlers.** `ListDetailPage` thought save, copy-quote, MemoriesPage drift fetch and "Reviewed" mark, ArticleCard reaction tag save, ProjectsPageCarousel star toggle, FocusSummary return — `catch { /* silent */ }` or `catch { console.error }` patterns. User believes the action succeeded.
- **Inconsistent confirmation for destructive actions.** Project graveyard confirmed in `ProjectDetailPage` but not in `ProjectCard` or `ReviewDeck`. Project Mark Complete never confirmed. Settings "Reset to default" wipes a custom brief silently. List delete confirmed, but RSS dismiss + ProjectCompletionModal reflection skip aren't.
- **Native `window.confirm()` mixed with the app's `useConfirmDialog`.** `ReadingPage.tsx:726` and `ProcessingDebugPanel.tsx:129` use the blocking native confirm; everywhere else uses the in-app dialog. CreateConnectionDialog uses `alert()` for errors when the rest of the app uses `addToast`.
- **Touch targets under 44px.** SmartActionDot (24×24), MemoryCard checklist toggles (16×16), ProjectsPageCarousel reveal buttons (28×28), BookshelfStep remove-book X (24×24), Toast close (32×32), KeepGoingCard inner Play (28×28), FirstConnectionCelebration X (24×24).
- **Dead code shipped in production.** `STRIP_OPTIONS` + `getOptionForDy` in VoiceFAB; `handleItemClick`, `handleLinkItem`, `getIcon` in ContextSidebar; `useCallback` imported but unused in two connection components; `showSuggestions` state in CreateConnectionDialog; `BedtimeFloatingIcon`, `FeelingPill`, `YourHourHeader` in `components/home/`; `SaveArticleDialog`; the `article` branch in CreateMenuModal/VoiceFAB; `ProjectCarousel`, `ProjectLineage`, `ProjectListRow`, `SpotlightCard`, `ProjectPickerDialog`, `ShapingModal`, `ReviewDeck`, `ProactiveGuideBar` — all unreferenced.
- **Stripped emoji artifacts.** `PullToRefresh.tsx:97` empty `<span>` and line 125 leading space (used to be a checkmark). `ui/progressive-loading.tsx:85-111` icons replaced with literal `'...'`. Probably ran an emoji-stripping pass somewhere.
- **HTML5 drag-and-drop on touch.** `PinnedTaskList` and `ProjectPath` task reordering uses `draggable` HTML attr, which doesn't work on iOS/Android. The `GripVertical` icon implies it should.
- **Same label, two destinations.** BedtimePage has two "Drift" controls — one opens an overlay, one navigates to `/memories`. ListsPage and ReadingPage both render a "Search" magnifier that routes to `/search` (global), not list/reading-scoped.
- **Label/handler mismatches.** ReaderPage "Archive" opens a completion dialog instead of archiving. FocusSession "Next" means "Skip." ProjectCompletionModal "Done" advances to another step. Power Hour "Start" just scrolls. RSSFeedItem "Read Article" opens external link, not the in-app reader. EmptyState "Load demo instead" only clears a localStorage flag.
- **Nested `<button>` inside `<button>`.** ProjectMiniCard, FoundationalPrompts "Edit" — invalid HTML.

---

## Full table

Format: ` | # | location | label / purpose | expected (click / hold / drag) | actual | divergence | `

### 1 · Home (HomePage + components/home/)

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 1 | HomePage.tsx:217 | "Try Again" error fallback | Reload page | `window.location.reload()` | OK |
| 2 | HomePage.tsx:260-272 | Moon icon (bedtime) — visible after 21:30 only | Click → `/bedtime` | `navigate('/bedtime')` | Hidden visibility rule; no other affordance. Missing `haptic`. |
| 3 | HomePage.tsx:273-280 | Search magnifier | Click → `/search` | navigate | OK |
| 4 | HomePage.tsx:344-352 | Footer Settings link | Click → `/settings` | navigate | OK |
| 5 | HomePage.tsx:107-140 | NowConsuming row | Click opens the item | `<Link>` to `/lists/{listId}` (list, not item) | Preview shows a specific item, click goes to parent list. No item deep-link. |
| 6 | KeepGoingCard.tsx:104-117 | Hero priority card surface | Click opens project | `navigate('/projects/{id}')` | `<div>` with `cursor-pointer` — no role/tabIndex/keyboard. No aria-label. |
| 7 | KeepGoingCard.tsx:179-198 | "Start session" Play button | Start power hour, disabled while loading | `start({prefetched: plan})`; disabled while loading | OK; no surfaced error if `start()` rejects. |
| 8 | KeepGoingCard.tsx:221-226 | "Open projects" empty-state link | Navigate to /projects | navigate | OK (semantically should be `<Link>`). |
| 9 | ProjectMiniCard.tsx:68-77 | Whole card `<button>` | Click opens project | `navigate('/projects/{id}')` | **Nested button**: outer is `<button>`, inner Play is also `<button>`. Invalid HTML. |
| 10 | ProjectMiniCard.tsx:132-152 | Inner Play | Start session; outer suppressed | `stopPropagation`; `start()`; disabled while loading | **28×28 touch target**; silent failure on `start()` rejection. |
| 11 | ProjectIdeasHome.tsx:388-408 | "✦ suggest a project" pill | Get a project idea | If queue has ideas → instant reveal; else → ~10s LLM call | **Two completely different behaviors behind one label.** No aria-label, no in-progress guard beyond an `if (generating) return`. |
| 12 | ProjectIdeasHome.tsx:716-726 | "see the signal" / "hide signals" toggle | Toggle evidence drawer | `setShowEvidence(s => !s)` | No `aria-expanded`. |
| 13 | ProjectIdeasHome.tsx:773-783 | Reason chip (Not my thing / Too vague / etc.) | Dismiss idea with reason | `dismissIdea(active, reason)`, disabled while pending | No per-chip loading indicator; only a global opacity-30. User can't tell which one fired. No undo. |
| 14 | ProjectIdeasHome.tsx:784-792 | "just not for me" | Dismiss with no reason | `dismissIdea(active)` | Same: no per-button loading, no undo. |
| 15 | ProjectIdeasHome.tsx:795-806 | "✕ not for me" (collapsed) | Dismiss now | Only opens the reason picker | **Misleading**: X + "not for me" + `title` all imply dismiss-now; click is "open submenu." Two-step disguised as one-step. |
| 16 | ProjectIdeasHome.tsx:810-824 | "Save" CTA (BookmarkPlus) | Save as project | `saveIdea(active)`; disabled + label flips to "saving…" | OK |
| 17 | FirstConnectionCelebration.tsx:71-77 | X dismiss on celebration overlay | Close overlay | `setVisible(false)` | **No aria-label**; 24×24 target; once dismissed never returns (markFirstConnectionSeen fires on first show). |
| 18 | BedtimeFloatingIcon.tsx:31-49 | Moon FAB | `/bedtime` | navigate | **Dead code** — not mounted from HomePage. |
| 19 | FeelingPill.tsx:46-60 | focused/scattered/restless | Set feeling pill | `setFeeling(...)` | **Dead code** — but CLAUDE.md explicitly calls out as a planned home input. |
| 20 | YourHourHeader.tsx:45-52 | Search in your-hour header | navigate('/search') | navigate | **Dead code** — replaced by inline masthead. |
| 21 | UpNextShelf.tsx:90-150 | Drag/tap/✕ unpin row | Reorder / open / unpin | `Reorder` group + handlers | (Used on ProjectsPageCarousel, not Home.) X unpin no confirm; drag handle no keyboard equivalent. |

### 2 · Projects (ProjectsPage, ProjectDetailPage, components/projects/)

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 22 | ProjectsPage.tsx:83-117 | Completed-project card | Open project | `onNavigate(project.id)` | OK |
| 23 | ProjectsPage.tsx:199-206 | Back arrow from "Completed" | Return to projects | `setShowCompleted(false)` | OK |
| 24 | ProjectsPage.tsx:222-229 | Check icon — view completed | Show completed timeline | `setShowCompleted(true)` | OK |
| 25 | ProjectsPage.tsx:231-238 | Search magnifier — "Search everything" | Open global search | navigate('/search') | OK |
| 26 | ProjectsPageCarousel.tsx:152-181 | Project card `<Link>` | Click navigates; long-press 450ms reveals action buttons for 4s | Same | **Long-press is the only path to those actions** — undiscoverable. Different contract from `ProjectCard.tsx` (#32) which opens a full bottom-sheet. Two long-press contracts in the same app. |
| 27 | ProjectsPageCarousel.tsx:192-198 | Tiny dot — "What connects here" | Open Context sidebar | `toggleSidebar(true)` | **No aria-label**; 28×28 target; 8px visual dot has nearly zero affordance. |
| 28 | ProjectsPageCarousel.tsx:201-212 | ListOrdered — Up Next toggle | Toggle pinning | `setUpNext` | Reveal-only via long-press. No aria-label. |
| 29 | ProjectsPageCarousel.tsx:213-229 | Star — priority | Toggle priority | `setPriority(project.id)` with no try/catch | **Swallows `focus_cap_reached` 409.** ProjectCard.tsx version handles it. |
| 30 | ProjectsPageCarousel.tsx:354-362 | "Revive" (ArchivesSpotlightCard) | Resurrect archived | `handleResurrect` with toast | OK (but card not currently rendered — `archiveSpotlight` always null). |
| 31 | ProjectCard.tsx:213-303 | Card `<Link>` + 450ms long-press | Navigate; long-press opens sheet | Same | Two ProjectCard implementations (this file + inline in ProjectsPageCarousel) with different UX. |
| 32 | ProjectCard.tsx:345-351 | X close in long-press sheet | Close | `setShowContextMenu(false)` | OK |
| 33 | ProjectCard.tsx:356-374 | Set/Remove Priority | Toggle priority | Full error handling with focus_cap toast | OK |
| 34 | ProjectCard.tsx:376-398 | Add/Remove Up Next | Toggle | `handleToggleUpNext` with cap-reached replace flow | OK |
| 35 | ProjectCard.tsx:400-414 | View Insights | Open Context sidebar | `handleViewInsights` | OK |
| 36 | ProjectCard.tsx:416-430 | Mark Complete | Complete project | updateProject status='completed' | **No confirmation** for ritual-triggering action. |
| 37 | ProjectCard.tsx:432-446 | Send to Graveyard | Archive | updateProject status='graveyard' | **No confirmation** — but `ProjectDetailPage.tsx:711-728` *does* confirm. Inconsistent. |
| 38 | ProjectCard.tsx:470-477 | "Add" quick task | Create task inline | `handleQuickAddTask`; no loading state | Rapid double-tap creates duplicates. |
| 39 | ProjectCard.tsx:481-496 | Quick Add Task reveal | Show input | `setShowQuickAddTask(true)` | OK |
| 40 | ProjectCard.tsx:498-508 | Open Project → | Navigate | navigate | Redundant with card link. |
| 41 | DrawerDigestSheet.tsx:93-111 | Weekly digest banner | Open digest | `setOpen(true)` | OK |
| 42 | DrawerDigestSheet.tsx:135-140 | X close digest modal | Close | `setOpen(false)` | No aria-label. |
| 43 | DrawerDigestSheet.tsx:187-200 | "Accept" evolution | Apply evolution | api.post; disables all while one runs | **No confirmation** for project mutation; no per-row reject (only global Dismiss). |
| 44 | DrawerDigestSheet.tsx:206-211 | Dismiss digest | Mark read | dismiss() | OK |
| 45 | ForYouToday.tsx:58-83 | Warmed project card | Open project | navigate | OK |
| 46 | CreateProjectDialog.tsx:317-325 | "+" trigger | Open sheet | setOpen(true) | OK |
| 47 | CreateProjectDialog.tsx:427-438 | Chat send | Send message | `handleSend`; disabled empty/thinking | OK |
| 48 | CreateProjectDialog.tsx:443-450 | "Just quick-add →" | Switch mode | `setQuickAddMode(true)` | Opacity 30% — easy to miss. |
| 49 | CreateProjectDialog.tsx:452-473 | "Make this a project →" | Extract form from chat | `handleExtract` | OK |
| 50 | CreateProjectDialog.tsx:492-499 | "back to conversation" | Return to chat | `setMode('chat')` | OK |
| 51 | CreateProjectDialog.tsx:554-568 | Type pill | Set project type | setFormData | OK |
| 52 | CreateProjectDialog.tsx:576-590 | Finish/Habit mode | Set project_mode | setFormData | OK |
| 53 | CreateProjectDialog.tsx:594-609 | Submit (ArrowUp) | Create project | handleSubmit; disabled while invalid/loading | OK |
| 54 | CreateProjectDialog.tsx:623-629 | "back to conversation" (quick-add) | Return | `setQuickAddMode(false)` | OK |
| 55 | CreateProjectDialog.tsx:657-668 | "Save for later" quick-add | Create unshaped | handleQuickAdd; spinner | OK |
| 56 | ProjectDetailPage.tsx:84-99 | Blocker Cancel/Save | Discard / persist | resetting / handleSave with loading | OK |
| 57 | ProjectDetailPage.tsx:102-115 | Blocker post-it `<p>` | Click to edit | onClick on a `<p>` | `<p>` not `<button>`; no keyboard/role/tabIndex. |
| 58 | ProjectDetailPage.tsx:668-674 | "← Back" | /projects | navigate | OK |
| 59 | ProjectDetailPage.tsx:676-683 | MoreVertical kebab | Open menu | toggle showMenu | OK |
| 60 | ProjectDetailPage.tsx:692-698 | "Edit Details" | Open dialog | setShowEditDialog | OK |
| 61 | ProjectDetailPage.tsx:699-709 | "Pin"/"Unpin" | Toggle pin | toggles | **Label uses stricter comparison** than the handler — can show "Pin" while clicking unpins. |
| 62 | ProjectDetailPage.tsx:711-728 | "Send to graveyard" | Archive | confirm → handleStatusChange | OK (confirmed) |
| 63 | ProjectDetailPage.tsx:729-734 | "Delete" | Delete | confirm → deleteProject | OK |
| 64 | ProjectDetailPage.tsx:687-690 | Menu backdrop | Close menu | setShowMenu(false) | OK |
| 65 | ProjectDetailPage.tsx:822-832 | "Start" (Power Hour banner) | Begin focus session | **Only scrolls to task list** | **Label/behavior mismatch.** Check icon + "Start" implies action; only scrolls. |
| 66 | ProjectDetailPage.tsx:861-862 | Finish-line Cancel/Save | Cancel/save goal | saveGoal — no disabled/loading | No loading state on save. |
| 67 | ProjectDetailPage.tsx:843-870 | Finish-line wrapper `<div>` | Tap to edit | onClick on div | div-as-button. |
| 68 | ProjectDetailPage.tsx:943-949 | "Mark Complete" | Complete project | handleStatusChange('completed') | **No confirmation** — inconsistent with graveyard which is confirmed. |
| 69 | ProjectDetailPage.tsx:977-983 | "Add Note" | Open dialog | setShowAddNote | OK |
| 70 | PinnedTaskList.tsx:56-89 | Task row draggable | Drag to reorder | HTML5 draggable | **No touch support** — silently fails on iOS/Android. |
| 71 | PinnedTaskList.tsx:72-88 | Task checkbox | Toggle done | onToggle | OK |
| 72 | ProjectPath.tsx:246-272 | Phase header | Toggle phase expand | togglePhase | OK |
| 73 | ProjectPath.tsx:293-310 | Task row draggable | Drag to reorder | HTML5 draggable | **No touch support** — but GripVertical icon promises it works. |
| 74 | ProjectPath.tsx:322-331 | Task checkbox | Toggle done | handleToggleTask | 20×20 target under guideline. |
| 75 | ProjectPath.tsx:351-357 | Task text div | Click to edit | onClick on div | div-as-button. |
| 76 | ProjectPath.tsx:359-370 | Estimate pill | Cycle time estimate | Cycles 5/10/15/25/45/60 | Non-obvious cycling; can't set a specific estimate without tapping repeatedly. |
| 77 | ProjectPath.tsx:383-390 | Trash | Delete task | confirm → onUpdate | OK |
| 78 | ProjectPath.tsx:419-426 | "Add" (in-phase) | Append task | handleAddTask | OK |
| 79 | ProjectPath.tsx:429-436 | "+ Add" (start adding) | Show input | setAddingInPhase | Opacity 20% — very hard to see. |
| 80 | ProjectPath.tsx:456-467 | "N things done" | Toggle Built trail | setShowBuilt | OK |
| 81 | ProjectPath.tsx:483-489 | Completed task checkbox | Unmark done | handleToggleTask | OK |
| 82 | InlineGuide.tsx:583-600 | X / Apply on pending op | Dismiss / apply | dismissOp / applyTaskOp + recordSnapshot | OK |
| 83 | InlineGuide.tsx:642-659 | Skip / Apply (goal update) | Dismiss / apply | dismissGoalUpdate / applyGoalUpdate | OK |
| 84 | InlineGuide.tsx:687-697 | "Go ahead" apply-all | Apply all in turn | applyEverything | No loading state. |
| 85 | InlineGuide.tsx:698-704 | "Not now" | Dismiss all | dismissAll | OK |
| 86 | InlineGuide.tsx:728-734 | "Undo" | Restore snapshot | undoChanges | OK |
| 87 | InlineGuide.tsx:744-750 | "Add all" suggested tasks | Add every | forEach handleAddTask | Reversible via individual delete; acceptable. |
| 88 | InlineGuide.tsx:764-775 | "Add"/"Added" | Add one suggested task | disabled when added | OK |
| 89 | InlineGuide.tsx:850-862 | Send (ArrowUp) | Send guide message | handleSend; disabled empty/thinking | No aria-label on icon-only. |
| 90 | AddNoteDialog.tsx:218-237 | Trash / "Add another bullet" | Remove / append | removeBullet / addBullet | OK |
| 91 | AddNoteDialog.tsx:246-270 | "Add" image upload | Open file picker | Invisible file input overlay | No `<label htmlFor>` for the input. |
| 92 | AddNoteDialog.tsx:302-308 | × remove image | Remove file | removeFile | No aria-label; symbol is `&times;`. |
| 93 | AddNoteDialog.tsx:318-339 | "Save Note" | Persist note | handleSave; spinner | OK |
| 94 | EditProjectDialog.tsx:115-127 | Type pill | Set type | setFormData | OK |
| 95 | EditProjectDialog.tsx:163-177 | "Save Changes" | Persist | handleSubmit; disabled loading | OK |
| 96 | CompletionRitual.tsx:78-83 | X close | Close | reset() | No aria-label. |
| 97 | CompletionRitual.tsx:144-149 | "Skip" | Close without saving | reset() | OK |
| 98 | CompletionRitual.tsx:150-163 | "Finish & spark" | Submit retro | submit(); spinner | OK |
| 99 | CompletionRitual.tsx:207-217 | "Done" post-spark | Close | reset() | OK |
| 100 | CompletionRitual.tsx:64 | Backdrop click | Close ritual | onClick=reset | **Destroys typed retro answers** on mis-tap. |
| 101 | ProjectCompletionModal.tsx:100 | Backdrop | Close modal | onClose | Loses celebration. |
| 102 | ProjectCompletionModal.tsx:119-125 | X close | Close | onClose | No aria-label. |
| 103 | ProjectCompletionModal.tsx:168-178 | "Done" celebration | Continue to reflection | `setStep('reflection')` | **Label says "Done" but advances to another step.** Should be "Continue". |
| 104 | ProjectCompletionModal.tsx:199-206 | "Save reflection"/"Done" | Save or close | label flips based on text presence | Sneaky label flip — easy to mis-tap. |
| 105 | ProjectCompletionModal.tsx:207-213 | "Skip" | Close | onClose | Loses typed reflection without warning. |
| 106 | LineageBreadcrumb.tsx:36-65 | Parent/sibling/expand | Navigate / toggle | `<Link>` / setExpanded | OK |
| 107 | ProjectLineage.tsx:64-108 | Versions expand / "Revert" | Toggle / restore | setOpen / handleRevert | **Component not rendered anywhere.** |
| 108 | ProjectListRow.tsx:109-235 | Star / submit task / "Add task" | Toggle / add / start | setPriority (no error handling); handleAddTask (no loading) | **Component not currently rendered.** |
| 109 | SpotlightCard.tsx:54-69 | Card link | Navigate | `<Link>` | OK (unrendered). |
| 110 | ProjectPickerDialog.tsx:64-125 | X / project row | Close / select | onOpenChange / onSelect | No aria-label on X (unrendered). |
| 111 | ShapingModal.tsx:203-306 | X / Send / "Shape it →" | Close / send / extract | onClose / handleSend / handleExtractAndShape | No aria-labels (unrendered). |
| 112 | ReviewDeck.tsx:65-321 | Back / X / Snooze / Action / Active / Graveyard / swipe | Various | handleSwipe + handlers | "Action" label unclear; **Graveyard no confirmation**; many icon-only buttons no aria-label (unrendered). |
| 113 | ProactiveGuideBar.tsx:83-123 | Full bar | Open guide | onOpen | OK (component unused — not imported by ProjectsPage). |

### 3 · Memories, Timeline, Search

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 114 | MemoriesPage.tsx:460-467 | Search masthead | Open search | navigate('/search') | OK |
| 115 | MemoriesPage.tsx:485-501 | "Drift mode / Bedtime mode" pill | Open drift overlay | handleOpenDrift fetches + opens | No loading state — repeated taps queue fetches; fetch errors only console.error. |
| 116 | MemoriesPage.tsx:503-510 | "bedtime" Link (Moon) | Go to /bedtime | `<Link>` | Twin affordance with #115 — both about bedtime, different destinations. |
| 117 | MemoriesPage.tsx:515-524 | PremiumTabs Thoughts/Themes/Resurface | Switch view | setView | OK |
| 118 | MemoriesPage.tsx:595-602 | Clear search X | Reset query | setSearchQuery('') | OK |
| 119 | MemoriesPage.tsx:660-672 | "Back to themes" | Leave cluster | setSelectedCluster(null) | OK |
| 120 | MemoriesPage.tsx:786-822 | Pinned thought motion.div | Open detail | handleOpenDetail | motion.div without role/tabIndex/keyboard. |
| 121 | MemoriesPage.tsx:837-844 | "load more" | Paginate | setVisibleCount | OK |
| 122 | MemoriesPage.tsx:857-864 | "Reviewed" | Mark reviewed | handleReview | **No loading state**; double-tap fires duplicate POSTs; errors silent. |
| 123 | CreateMemoryDialog.tsx:100-130 | Seed dismiss / seed pill | Hide / insert text | setDismissed / onSelect | Seed insert overwrites body. |
| 124 | CreateMemoryDialog.tsx:142-154 | ToolbarBtn wrapper | Generic button | render | No aria-label, only `title`. |
| 125 | CreateMemoryDialog.tsx:217-262 | Checklist Square/X/"+ New item" | Toggle / remove / add | toggleItem / removeItem / addItem | h-4 w-4 toggle target too small. |
| 126 | CreateMemoryDialog.tsx:571-578 | "+" masthead trigger | Open sheet | setOpen(true) | OK |
| 127 | CreateMemoryDialog.tsx:652-659 | Image remove X | Remove image | removeFile | No aria-label. |
| 128 | CreateMemoryDialog.tsx:672-720 | Toolbar (text/checklist toggle, bold/italic/list, photo, more) | Each formatting | apply / setIsChecklistMode | Modes change `title` only. **Photo button has no-op `onClick`**; hidden file input overlay carries real click. |
| 129 | CreateMemoryDialog.tsx:755-789 | Type pill / "Done" submit | Set type / save | setFormData / handleSubmit | **Auto-save fires on close (drag/X/backdrop)** — "Done" is redundant; auto-save undiscoverable. |
| 130 | CreateMemoryDialog.tsx:802-829 | Recent tag pill | Toggle tag | Add/remove from tags | OK |
| 131 | EditMemoryDialog.tsx:25-439 | Same toolbar pattern + Save Changes / Cancel | Same | Same | Same issues as #128. |
| 132 | MemoryDetailModal.tsx:171-264 | Backdrop / X / Analyze dot / Pin/Unpin / Edit / Trash | Various | Most OK | **Analyze dot** is a 10px purple dot inside a 40px circle — undiscoverable; only `title`. **Pin/Unpin** no loading state — rapid clicks can race. Trash has confirm — OK. |
| 133 | MemoryDetailModal.tsx:277-303 | Checklist toggle | Toggle item | updateChecklistItems | Optimistic; no error path. |
| 134 | MemoryDetailModal.tsx:347-376 | Connected thought row | Open related memory | `navigate('/memories?highlight=...')` | **BROKEN**: deep-link effect at MemoriesPage.tsx:172 reads `?id=...` not `?highlight=...`. Click closes modal and lands nowhere useful. |
| 135 | MemoryCard.tsx:306-329 | Card surface | Tap = open detail, long-press = context menu | pointerDown/Move/Up + onClick | Long-press undiscoverable. |
| 136 | MemoryCard.tsx:370-394 | Checklist toggle (in card) | Toggle | with stopPropagation | OK |
| 137 | MemoryCard.tsx:248-287 | Context menu items | Open/Pin/Analyze/Grow/Copy/Share/Delete | onClick handlers | "Analyze with AI" uses an undecorated colored dot — inconsistent with lucide icons. |
| 138 | ThemeClusterCard.tsx:75-100 | Overlay button / "Start project" | Open cluster / open dialog | onClick / setSeedOpen | OK |
| 139 | TagEditor.tsx:108-184 | Tag chip X / "+ add tag" / suggestion | Remove / show input / add | removeTag / setAdding / onMouseDown | OK |
| 140 | ThemeEditor.tsx:107-181 | Same pattern as TagEditor | Same | Same | OK |
| 141 | ExtractionSummary.tsx:85-187 | Dismiss X / "add to {project}" / "start something new" / "{project}" / "see lists" / "open" | Hide / navigate | setVisible / navigate | Dismiss X no aria-label. |
| 142 | SteeringCard.tsx:113-145 | X dismiss / "Pin Thought" | Hide / pin source | setVisible / handlePinThought | "Pin Thought" no loading state. |
| 143 | TimelinePage.tsx (all) | (no controls) | — | — | **Zero interactivity** despite bars/rows looking tappable. No refresh, no filter, no drill-down. |
| 144 | SearchPage.tsx:320-349 | Search form / Mic | Submit / open voice | handleTextSearch / setShowVoiceSearch | OK |
| 145 | SearchPage.tsx:373-388 | "Exact" / "Smart" pills | Switch search mode | setSearchMode + maybe refire | **Fragile**: refires search using freshly-set state, relies on closure read of latest searchMode. |
| 146 | SearchPage.tsx:441-505 | Result card motion.div | Navigate to item | onClick + navigateToResult | motion.div not keyboard-accessible. For `type=suggestion`, navigates to `/suggestions` (loses which result was clicked). |
| 147 | SearchPage.tsx:362-368 | VoiceSearch panel buttons | Voice → query | onClose / handleSearch | OK |

### 4 · Lists & Reading

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 148 | ListsPage.tsx:243-280 | Favourites star / Reorder / Plus / Search | navigate / toggle / open / navigate | All handlers wired | "Search lists" actually navigates to global search. |
| 149 | ListsPage.tsx:312-318 | Empty-state "Create a collection" | Open dialog | setCreateOpen | OK |
| 150 | ListsPage.tsx:330-360 | Example collection card | Show what a type looks like | setCreateOpen with no type prefill | Click suggests type matters; dialog opens at default. |
| 151 | ListsPage.tsx:383-429 | Reorder.Item card | Drag to reorder | Framer Reorder | No tap handler in reorder mode — no cue that taps do nothing. |
| 152 | ListsPage.tsx:453-464 | List card normal | Tap opens list; long-press 500ms opens action sheet | handleCardClick + long-press | Long-press undiscoverable; only a small footer hint. |
| 153 | ListsPage.tsx:558-568 | Plus on card | Quick add sheet | setQuickAddList | OK |
| 154 | ListsPage.tsx:630-714 | Action sheet (Quick Add / Customise Cover / Reorder / Delete) | Various | All wired; delete has confirm | Delete no loading state after sheet closes. |
| 155 | ListDetailPage.tsx:62-87 | StarRating star | Click to set; re-click to clear | with stopPropagation | OK |
| 156 | ListDetailPage.tsx:184-200 | Celebration star / "Skip rating" | Set rating / advance | handleRate / setStep | "Skip rating" advances rather than exits — mild label mismatch. |
| 157 | ListDetailPage.tsx:222-236 | "Save thought"/"Done" / "Skip" | Save voice/text / close | handleSaveThought / onClose | **Errors silently swallowed** (`catch {}`). User assumes save succeeded. |
| 158 | ListDetailPage.tsx:432-554 | QuoteCard Save/Cancel/Pencil/Copy/Trash + author edit | Various | Wired | **Copy failure swallowed silently.** Author save Check no aria-label. |
| 159 | ListDetailPage.tsx:744-761 | Status pill cycle | Cycle pending→active→completed→pending | handleStatusCycle | Cycle direction not signposted. |
| 160 | ListDetailPage.tsx:807-843 | "Details →" link / reaction buttons | External link / toggle reaction | `<a target=_blank>` / onReact | OK |
| 161 | ListDetailPage.tsx:872-878 | Trash | Delete item | handleDeleteItem → confirm | OK |
| 162 | ListDetailPage.tsx:1156-1239 | Article list mode (Back, Refresh, Save, card) | Various | Wired | **Refresh icon never spins** while loading; double-click refires. |
| 163 | ListDetailPage.tsx:1578-1762 | Detail view: Back / sort / Settings2 / MicOff / Mic / Add / X search / Search | Various | Wired | Settings2, MicOff, Mic — no aria-labels. |
| 164 | ListDetailPage.tsx:2003-2014 | ToggleLeft/Right — Progress tracking | Toggle hasStatus | updateListSettings | Reads as "ToggleRight" via SR; no aria-label. |
| 165 | ListDetailPage.tsx:938-999 | SortableItemCard / SortableQuote drag handle | Drag to reorder; touch needs 220ms hold | dnd-kit | **Long-press-to-drag undiscoverable** — no grip icon, no hint. |
| 166 | ReadingPage.tsx:762-769 | Search masthead | Global search | navigate | Same "Search" label as ListsPage. |
| 167 | ReadingPage.tsx:806-887 | "Save" URL / "Cancel" processing | Save / cancel | disabled when empty; spinner | OK |
| 168 | ReadingPage.tsx:925-988 | Continue Reading row / "+N more" / "Manage feeds" | Navigate | navigate | OK |
| 169 | ReadingPage.tsx:1014-1025 | "Sync feeds" (empty state) | Sync RSS | handleRSSSync | OK |
| 170 | ReadingPage.tsx:1095-1133 | Article card wrapper | Toggle selection / open reader | toggleSelection / ArticleCard onClick | OK |
| 171 | ReadingPage.tsx:725-728 | Bulk delete confirm | Confirm + delete | **`window.confirm`** | Inconsistent with rest of app's `useConfirmDialog`. |
| 172 | ReadingPage.tsx:701-723 | Bulk archive | Archive selection | no confirm | OK (lower destructiveness). |
| 173 | ArticleCard.tsx:170-335 | Card / MoreVertical / reactions / Connect / Open / Archive / context menu items | Various | Wired | **"Archive" also opens Connections dialog** — surprising. Reaction failures swallowed silently. |
| 174 | RSSFeedItem.tsx:28-139 | Card / BookmarkPlus / X / "Read Article" / ExternalLink | Toggle / save / dismiss / open / open | onSave / onDismiss / window.open | **"Read Article" opens external link, not in-app reader** (label mismatch). **ExternalLink button duplicates Read Article** (same behavior). Dismiss no confirm but persisted 90 days. |
| 175 | ReadingProvocation.tsx:46-55 | "Read it" / X dismiss | Navigate / hide | navigate / setDismissed | Dismissal not persisted — banner reappears. |
| 176 | ArticleConnectionsDialog.tsx:67-136 | X close / Discover / Skip / Done | Various | Wired | OK |
| 177 | ArticleCompletionDialog.tsx:90-201 | Text/Voice toggle / Skip / Save Thought / Skip for now | Various | Wired | OK |
| 178 | EditArticleDialog.tsx:153-167 | Save Changes / Saving | Submit | Disabled when invalid | OK |
| 179 | SaveArticleDialog.tsx:97-110 | Save Article / Saving | Submit | Disabled | **Component not imported anywhere.** Dead. |
| 180 | ReaderPage.tsx:519-572 | Back / Highlighter / Type×3 / Archive / Open original | Various | Wired | **Three Type icons look identical** — only color shows active. **Archive opens completion dialog** instead of archiving directly. Highlighter no aria-label. |
| 181 | ReaderPage.tsx:705-712 | Highlight color swatches | Pick shade | handleHighlight | Unlabeled circles. |
| 182 | ReaderPage.tsx:743-800 | Mic FAB / backdrop / X close | Open voice note / close | setShowVoiceNote | X no aria-label. |
| 183 | ReaderPage.tsx:373-383 | Swipe right from left edge | Navigate back | window touch handler | **Hidden gesture** — no visual cue; conflicts with iOS swipe-back. |
| 184 | ReaderPage.tsx:349-358 | Escape key | Navigate back | window keydown | Undocumented. |
| 185 | FavouritesPage.tsx:39-95 | FavouriteCard button | Open the favorited item | **Navigates to parent list, not item** | **Major divergence** — card shows item, clicks parent list. Lost context. |
| 186 | FavouritesPage.tsx:167-174 | "Back to Collections" | navigate('/lists') | navigate | OK |
| 187 | ProcessingDebugPanel.tsx:104-199 | Header / "Flush All" / "Retry" | Toggle / delete all / retry | window.confirm; onFlushAll; onRetry | **Inconsistent confirm** (window.confirm vs useConfirmDialog). |

### 5 · Bedtime / Cognitive Replay / Drawer / Onboarding

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 188 | BedtimePage.tsx:292 | Search icon (header) | Open search input/dialog | **No onClick** | **DEAD BUTTON.** |
| 189 | BedtimePage.tsx:379-396 | "Drift" pill / "Zen" pill | Open overlay | setDriftModeOpen / setZenModeOpen | OK |
| 190 | BedtimePage.tsx:399-411 | Refresh (RefreshCw) | Regenerate prompts | generateNew; disabled while generating | No aria-label. |
| 191 | BedtimePage.tsx:417-424 | "drift mode" tiny link → /memories | Drift in memories | `<Link>` | **Conflicts with #189**: same word, different destination. |
| 192 | BedtimePage.tsx:483-493 | Eye/EyeOff per prompt | Toggle viewed | markViewed | **One-way only** — can't un-view. Toggle icon implies reversibility. |
| 193 | BedtimePage.tsx:522-543 | Star rating 1-5 | Set rating | ratePrompt | Can't clear; no aria-label. |
| 194 | BedtimePage.tsx:547-575 | Breakthrough toggle | Toggle flag | toggleBreakthrough | OK |
| 195 | BedtimePage.tsx:443-579 | Prompt card (cursor-pointer + hover scale) | Should do something on tap | **No onClick on card** — inner buttons handle their own | **Misleading affordance** — looks clickable, isn't. |
| 196 | BedtimePage.tsx:640-659 | "Generate Now" empty state | Generate | generateNew; disabled | OK |
| 197 | ZenMode.tsx:116-230 | X close / chevron Left / chevron Right | Close / prev / next | onClose / handlePrevious / handleNext | **chevron Right also closes on last prompt** — hidden behavior. No aria-labels. |
| 198 | DriftMode.tsx:249-316 | X close / "Begin Session" | Close / start | onClose / requestMotionPermission | "Begin Session" no loading state. |
| 199 | DriftMode.tsx:333-340 | Full-screen tap during drifting | Tap to wake | triggerInsight only if no motion events | Hidden conditional — silent no-op if sensor active. |
| 200 | DriftMode.tsx:395-455 | "Drift Again" / "End Session" / "Return Home" | Restart / move to end / close | resetDrift / setStage / onClose | OK |
| 201 | MorningFollowUp.tsx:75-100 | X / Submit | Dismiss / send | onDismiss / handleSubmit | **No loading state on submit**. No aria-label. |
| 202 | CognitiveReplayPage.tsx:176-237 | Period pills / "Generate Replay" | Select range / run | setSelectedPreset / generateReplay; spinner | OK |
| 203 | DrawerPage.tsx:170-202 | Project tile `<Link>` | Navigate to project | `<Link>` | Long-press blocked via onContextMenu — surprises iOS users expecting share menu. |
| 204 | DrawerPage.tsx:205-221 | Pin (ListOrdered) | Toggle Up Next | handleTogglePin → `setUpNext` (add only) | **Cannot unpin.** aria-label promises "Remove from Up Next." |
| 205 | OnboardingChatPage.tsx:780-812 | "Sign in to begin" / "Not now" (unauth gate) | Login / home | navigate | "Not now" opacity 0.4. |
| 206 | OnboardingChatPage.tsx:873-899 | "Start talking" / "Not now" (welcome) | Begin / home | handleStart / navigate | OK |
| 207 | OnboardingChatPage.tsx:991-1004 | "Exit" (during turn) | Close + persist + home | persist + navigate | Opacity 0.35; **no confirmation** when mid-conversation. |
| 208 | OnboardingChatPage.tsx:1036-1041 | "Refresh" (silent-start) | Hard reload | window.location.reload | OK |
| 209 | OnboardingChatPage.tsx:1073-1090 | "Try again" / "Type instead" (stalled) | Retry / switch | handleRetryVoice / sets typingMode | OK |
| 210 | OnboardingChatPage.tsx:1112-1126 | "Skip this one" / "Send" (typing) | Skip / send | sendUserText / handleTypedSubmit | Skip opacity 0.5. |
| 211 | OnboardingChatPage.tsx:1147-1185 | "type instead" / Retry voice / Type instead (error) | Toggle / retry / clear | setTypingMode / handleRetryVoice | OK |
| 212 | BookshelfStep.tsx:151-359 | Skip / Remove book X / Search result / Continue | Various | Wired | Remove-book X is 24×24 (under 44). Duplicate book selection has no feedback. |
| 213 | DemoDataBanner.tsx:86-149 | "Yes, Clear" / "Cancel" / "Keep Exploring" / "Clear Demo" / X | Various | Two-step confirm | OK |
| 214 | EmptyState.tsx:47-65 | "Speak a thought" / "Load demo instead" | Navigate / load demo | navigate / removeItem+reload | **"Load demo instead" only removes a localStorage flag** — indirect. |
| 215 | FoundationalPrompts.tsx:111-163 | Prompt row / inner "Edit" | Open modal | handlePromptClick; **Edit has no handler** | **Nested button** — invalid HTML; click bubbles to parent by accident. |
| 216 | PostOnboardingFlow.tsx:245-593 | "Start your first project" / "I'll explore first" / "Build this" | Various | Wired | OK |
| 217 | PromptModal.tsx:93-198 | X close / Trash bullet / "Add bullet" / "Save" / "Skip for now" | Various | Wired; **Save has trailing space** in label | X discards typed input without confirm. Save doesn't disable on empty; relies on post-click validation. |
| 218 | RevealSequence.tsx:395-609 | "What could you build?" / "Build this" / "Not quite right" / "Sign in" / "I'll find my own" / refinement controls | Various | Wired | OK |
| 219 | SuggestedPrompts.tsx:67-85 | "Skip" X / "Answer" | Dismiss / open modal | handleDismiss / handleAdd | Dismiss no loading state — double-click double-dismisses. |
| 220 | UnauthHome.tsx:256-273 | "start talking" / "sign in" | Navigate to login | navigate | OK |
| 221 | WelcomeModal.tsx:44-215 | Backdrop / X / "Load Demo Data" / "Start with voice" | Various | Wired | X no aria-label. **Start with voice** fire-and-forgets `onStartFresh` before navigating. |
| 222 | FocusSession.tsx:166-441 | X close (overview/tasks) / "Begin" / Cancel/Park It / Wrap Up / Next / Check / Park Thought | Various | Wired | **X buttons no confirmation** — destructive mid-session. **"Next" actually means "Skip"** — footer hint is opacity-50. No aria-labels on Xs. |
| 223 | FocusSummary.tsx:98-224 | Rating icons / voice note trigger / "Return to Day" | Set rating / show capture / persist | setRating / setShowVoiceCapture / handleExit | Rating can't be cleared. **"Return to Day" no loading state** — double-tap fires twice. |

### 6 · Settings / Login / Fix Queue / Context Engine / Connections

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 224 | SettingsPage.tsx:264-271 | Search icon | Global search | navigate('/search') | No aria-label. |
| 225 | SettingsPage.tsx:300-312 | "Reset" theme colors | Reset to default | resetThemeColors; disabled when at default | OK |
| 226 | SettingsPage.tsx:339-385 | Intensity / Font size pills | Set preset | setIntensity / setFontSize | OK |
| 227 | SettingsPage.tsx:441-463 | Brief "Reset to default" / "Save" | Reset / save | API call; disabled when default | **Reset has no confirmation** — wipes custom prompt silently. |
| 228 | SettingsPage.tsx:491-544 | Bedtime / Morning toggle pills | Toggle notifications | toggleBedtime / toggleMorning | No `role="switch"`, no aria-label. |
| 229 | SettingsPage.tsx:600-735 | Bug Tracker toggle / Handoff toggle / Find connections / Tidy thoughts / Rescan tags | Toggle / run | Various | Handoff toggle no in-flight disabled. |
| 230 | SettingsPage.tsx:742-802 | "Reset onboarding" / "Yes, reset" / "Cancel" | Two-tap confirm + destructive | API call | OK |
| 231 | SettingsPage.tsx:858-873 | Color swatches | Pick color | onChange(hex) | OK |
| 232 | LoginPage.tsx:203-224 | "Verify" → / "use a different email" | Submit OTP / reset | handleVerifyOTP / reset | "use a different email" low affordance. |
| 233 | LoginPage.tsx:279-329 | "Send sign-in code" → / "Continue with Google" | Send OTP / OAuth | handleEmailOTP / handleGoogleLogin | **Shared `loading` state** between email/Google; Google error never rendered (only email shows error). |
| 234 | FixQueuePage.tsx:196-275 | Back / Refresh / "Approve" / "Reject" / "Mark Fixed" / "Done" | Various | Wired but inconsistent | **Refresh clickable while spinning.** **Reject no confirmation, no loading state**. **Mark Fixed/Done bypass API, write to Supabase directly** — inconsistent with approve. (Feature owner-unloved per CLAUDE.md.) |
| 235 | FixQueuePage.tsx:349-446 | Section header / fix card | Collapse / expand details | setCollapsed / onToggle | No aria-expanded. |
| 236 | ContextSidebar.tsx:188-378 | Backdrop / X / Refresh / 4 action chips / X result | Various | Wired | **Backdrop is `<div>` not button** — no keyboard dismiss. **Action chips share single loading lock** — only one shows spinner, others look enabled but aren't. Multiple icon-only buttons no aria-label. |
| 237 | ConnectionPathPicker.tsx:137-237 | Backdrop / X / result row | Close / pick | onClose / onSelect | Backdrop not keyboard-dismissible. X no aria-label. |
| 238 | ConnectionRevealOverlay.tsx:179-348 | Backdrop / X / "Done" | Close | onClose | Backdrop not keyboard-dismissible during multi-second animation. X no aria-label. |
| 239 | ConnectionsList.tsx:203-275 | Connection link / "Add Link" / "See path" | Navigate / open dialogs | `<Link>` / setShow* | **getItemUrl returns '#'** for unknown types — broken navigation silently. |
| 240 | CreateConnectionDialog.tsx:260-421 | Filter chips / item cards | Filter / connect | setSelectedType / onConnect | **Uses `alert()` on error** (inconsistent with rest of app's toast). Single shared `creating` flag disables all cards. |

### 7 · Global navigation / Voice / Misc overlays

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 241 | FloatingNav.tsx:362-411 | Tab buttons (Home/Thoughts/Projects/Lists) | Navigate | handleNavClick | **No aria-label on icon-only tabs**; no current-page guard. |
| 242 | FloatingNav.tsx:302-306 | VoiceFAB onTap prop | (proxy) | `handleVoiceFABTap` returns false; VoiceFAB never calls it | **Dead prop wiring.** |
| 243 | PageHeader.tsx:57-68 | Back arrow | Go back | navigate(-1) | OK |
| 244 | CreateMenuModal.tsx:24-138 | Backdrop / X / Thought / Project / List Item / hint | Dismiss / create / dismiss | onClose / onAction | **`article` is referenced in VoiceFAB switch but never offered** — dead code. X / backdrop no aria-label. |
| 245 | VoiceFAB.tsx:251-296 | Plus FAB | Tap = menu, hold ≥400ms = voice | onPointerDown/Up/Move/Leave | **JSDoc + dead code (`STRIP_OPTIONS`, `getOptionForDy`, `stripOverlay = null`) describe a slide-up strip that no longer exists.** aria-label is correct; visible behavior is correct; source code lies. |
| 246 | VoiceFAB.tsx:148-210 | Long-press timing logic | 400ms threshold | timer + 12px scroll guard | Sliding finger off FAB while holding stops recording — surprising. |
| 247 | VoiceFAB.tsx:323-358 | Voice modal backdrop / X | Close (relies on unmount to stop recorder) | setIsVoiceOpen(false) | X no aria-label. |
| 248 | VoiceInput.tsx:88-118 | Mic / Stop / Loading | Toggle / disable while processing | toggleRecording | OK |
| 249 | VoiceSearch.tsx:166-250 | X close / Mic / Clear / Search | Various | Wired | X / Mic no aria-label. Search no loading state. |
| 250 | BulkActionsBar.tsx:62-98 | X cancel / Action buttons | Cancel / run | onCancel / action.onClick; disabled while loading | X no aria-label. No enforced confirm for destructive variants. |
| 251 | DebugPanel.tsx:44-120 | Floating toggle / Clear / Close | Open / clear / hide | setIsVisible | **Toggle button is completely unlabeled** — 56×56 circle with no content. |
| 252 | SmartActionDot.tsx:21-50 | Zap dot — AI suggestion | Open analysis | optional onClick | No aria-label; 24×24 target. **Broken CSS** in backgroundColor on `var(...)` colors. |
| 253 | SuggestionToast.tsx:126-207 | X close / "Link these" / "Not now" | Close / accept / dismiss | handleClose / handleAccept / dismissSuggestion | **X close doesn't persist dismissal** — suggestion can resurface. "Link these" no loading state. |
| 254 | SignInNudge.tsx:322-340 | "start talking →" / "sign in" | Navigate | navigate | OK |
| 255 | PWAInstallBanner.tsx:67-134 | X / "Not now" / "Install" | Dismiss / install | handleDismiss / handleInstall | Install hides banner before awaiting prompt — if user cancels, banner doesn't reappear this session. |
| 256 | PWAUpdateNotification.tsx:98-139 | X / "Update Now" | Dismiss / reload | handleDismiss / handleUpdate | X no aria-label. |
| 257 | OfflineIndicator.tsx:128-156 | Pending bar (X inside) / "Sync now" / "Clear queue" | Expand / sync / wipe queue | setIsExpanded / handleSyncNow / handleClear (with confirm) | **Trailing X icon on pending bar is decorative** — looks like dismiss but only toggles expand. Sync no inline loading state. |

### 8 · Shared UI primitives

| # | Location | Label / purpose | Expected | Actual | Divergence |
|---|---|---|---|---|---|
| 258 | SwipeableCard.tsx:46-181 | Touch swipe left/right | Reveal action / fire on threshold | touchstart/move/end with passive listeners | **Listeners re-attached every render** (deps include swipeDistance — thrashes per pixel). Rejection from `action.onAction()` not handled. Delete + Archive presets visually identical (same color). **No keyboard alternative.** |
| 259 | PinButton.tsx:44-55 | Pin / PinOff icon | Toggle pinned state | handlePin | No aria-label. 36px target borderline. Re-pins on every parent render via effect on content. |
| 260 | PinOverlay.tsx:69-78 | Drag handle (minimized) | "Drag to expand or dismiss" | onDragEnd | **aria-label promises "dismiss" but drag never dismisses** from minimized — only the X does. |
| 261 | PinOverlay.tsx:89-107 | Title button / X unpin | Expand / unpin | setViewState('half') / handleUnpin | X 32×32 — borderline. |
| 262 | PinOverlay.tsx:131-168 | Drag handle (half/max) / X | Resize / unpin | offsetY > 50 shrinks; X unpins | "Drag to resize or dismiss" — drag still doesn't dismiss. |
| 263 | PullToRefresh.tsx:65-149 | Pull-down gesture | Refresh on threshold | usePullToRefresh hook | **Stripped emoji artifact**: empty `<span>` at line 97 and leading space in " Updated" at line 125. |
| 264 | FocusableList.tsx:49-121 | List swipe-left / item swipe-left | Open context sidebar | useSwipeGesture + per-item handlers | **Two competing swipe handlers** for same gesture, no visual affordance. |
| 265 | ItemInsightStrip.tsx:50-79 | Insight item / "See how this connects" | Display / open picker | (display) / setShowPathPicker | Insight item looks clickable due to styling but isn't. |
| 266 | ErrorBoundary.tsx:140-146 | "Reload Page" | Reload | handleReset + reload | OK |
| 267 | ui/GlassCard.tsx:15-77 | Glass card surface | Click if onClick provided | motion.div with cursor-pointer when isInteractive | **`isInteractive` defaults to true** — every GlassCard shows cursor-pointer + hover lift even with no onClick. Rendered as div, no keyboard. |
| 268 | ui/badge.tsx | Badge | Display | div with hover/focus styles | Focus ring on non-focusable div. Some variants have invisible text (same color as background). |
| 269 | ui/bottom-sheet.tsx:65-186 | Overlay / drag / X | Dismiss | onOpenChange(false) | OK |
| 270 | ui/button.tsx:42-60 | Base Button | onClick unless disabled | motion.button with whileTap/whileHover | whileTap/whileHover not guarded against disabled — animates on disabled clicks. |
| 271 | ui/confirm-dialog.tsx:72-87 | Cancel / Confirm | Close / run onConfirm | Cancel auto-closes; **Confirm does not auto-close** | Inconsistent contract — consumer must close after Confirm. No loading state. |
| 272 | ui/context-menu.tsx:42-160 | Backdrop / Cancel / Action row | Close / run | Wired | OK |
| 273 | ui/dialog.tsx:44-174 | Trigger / Overlay / X | Open / close | Wired | OK |
| 274 | ui/premium-tabs.tsx:24-48 | Tab buttons | Switch tab | onChange(tab.id) | **No role="tab"/aria-selected**; no keyboard navigation. |
| 275 | ui/progressive-loading.tsx | Loading messages | Display | (display) | Icons replaced with literal `'...'` (stripped emojis). |
| 276 | ui/toast.tsx:146-160 | Action / Close | Run / close | onClick | Action min-h-28px; X 32px target. Close no aria-label. |
| 277 | ui/tooltip.tsx | Tooltip wrapper | Tooltip on hover | Native `title` attribute | `side` prop accepted but ignored. Misleading API. |

---

## Areas worth reviewing further (not buttons but related)

- **Auto-save on close** in CreateMemoryDialog has no UI hint. Consider showing a "saved" toast and removing the redundant "Done" button.
- **TimelinePage** is read-only despite tappable-looking elements. Either signpost as a dashboard or add drill-downs.
- **Dead components in `components/home/`** (`BedtimeFloatingIcon`, `FeelingPill`, `YourHourHeader`) and `components/projects/` (`ProjectCarousel`, `ProjectLineage`, `ProjectListRow`, `SpotlightCard`, `ProjectPickerDialog`, `ShapingModal`, `ReviewDeck`, `ProactiveGuideBar`) plus `SaveArticleDialog` should be deleted or wired back in. The `FeelingPill` deletion would conflict with CLAUDE.md's stated home input plan — wire it instead.
- **Two ProjectCard implementations** (the exported one in `ProjectCard.tsx` and the inline one in `ProjectsPageCarousel.tsx`) with different long-press contracts. Pick one and delete the other.
