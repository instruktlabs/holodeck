# Configurable target-game complex: research and proposal

Research checked 25 October 2026. This is a fictional video-game environment and activity catalogue. It supplies game rules and visual themes, not firearm instruction, ballistics, physical construction specifications, or real facility safety claims.

## Design direction

Build a large recreational target-game campus with many visibly numbered lanes, a central chronological display promenade, and several contrasting activity halls. Use Maker for established controller testing. A later user steer requests a separate restrained soldier appearance prototype now; full rig/controller integration remains unimplemented. The gun wall and artwork belong to the same destination as the activities, so visiting an era display can lead directly to a themed game preset. Historical display identity and gameplay balance should remain separate data.

Give scale through repeated lane modules, distant galleries, signs, spectator seating, target machinery silhouettes, and distinct lighting zones. Only activate a bounded group of nearby lanes and target actors. Inactive lanes can show inexpensive scripted scenery. This is a proposed game-performance strategy, not a researched real-world layout.

## Primary references and usable abstractions

| Source | Verified broad observation | Game abstraction |
| --- | --- | --- |
| [National Shooting Complex: public/member activities](https://nsc.nssa-nsca.org/open-public-shooting-2/) | One venue advertises skeet, sporting clays, trap, and 5-Stand, alongside a museum in its site navigation. | Several activity families plus exhibition content can form one coherent destination. Do not copy its physical layout. |
| [NSCA: What is Sporting Clays?](https://nsca.nssa-nsca.org/what-is-sporting-clays-2/) | Courses use varied stations and target presentations, singles/pairs, and hit/miss scoring. | A playlist of visually different stations; configurable target paths and paired events; simple binary scoring. |
| [SCSA: official classifier stages](https://scsa.org/stages/) | Named repeatable stages have identifiers and multiple strings. | Stable preset IDs, repeatable rounds, comparable results, and versioned leaderboards. This proposal does not reproduce official stages. |
| [ISSF: discipline overview](https://www.issf-sports.org/issf/championships) | The overview describes ring targets, moving targets, falling targets, clay targets, and individual/team formats. | Independent target movement, response, scoring, and participation dimensions. Use its categories, not its operating procedures or dated competition details. |
| [Sport Singapore/ActiveSG: target standards](https://www.activesgcircle.gov.sg/learn/shooting/target-standards-for-shooting) | Paper and electronic scoring presentations coexist; visible target contrast and flash feedback help recognition. | Paper-look or digital skins over one hit-event system; readable contrast and clear audiovisual confirmations. |
| [Bisley Sporting Group: virtual simulator](https://www.bisleyshooting.co.uk/our-grounds-bisley-sporting-group/bisley-at-braidwood/virtual-reality-shooting/) | A venue offers a simulator with many selectable scenarios and group participation. | A simulator hall can host fantastical themed activities without rebuilding the campus. Avoid its hunting and combat scenarios for this target-only prototype. |

These pages establish category inspiration only. The following rules, accessibility features, progression, cooperative systems, and world structure are original proposals. No claim of official sanction or exact sport simulation is intended.

## Fourteen activity ideas

All targets are abstract shapes, paper graphics, discs, plates, or props; no human silhouettes are needed. “Timed” means a configurable videogame clock, with an untimed alternative where practical.

| Activity | Target / behavior | Rules and feedback | Origin | Priority |
| --- | --- | --- | --- | --- |
| Paper Gallery | Stationary paper-look rings | Fixed round budget; sum visible scoring zones; retain a paper souvenir graphic. | Ring/paper category inspired by ISSF and SportSG; game format invented. | Core |
| Plate Chorus | Reactive geometric plates | Clear all plates; each produces a distinct note; optional elapsed-time score. | Repeatable stage family inspired by SCSA; musical rule invented. | Core |
| Color Circuit | Stationary illuminated shapes | Activate the announced shape/icon sequence; configurable grace window and reminders. | Invented arcade activity. | Core |
| Pop-Up Garden | Abstract targets rise and retract | Collect target points during a session; optional targets remain visible until selected. | General reactive-target abstraction; game invented. | Core |
| Rail Parade | Moving discs on a visible rail | Score individual discs; choose constant, oscillating, or stop/start motion. | Moving-target category inspired by ISSF; patterns invented. | Core |
| Clay Constellation | Flying abstract discs | Hit/miss rounds with single or paired launches and celebratory particles. | Clay/singles/pairs categories inspired by NSCA; paths and scoring invented. | Core |
| Station Passport | Playlist of lane presets | Complete several distinct stations; earn completion stamps rather than requiring a score threshold. | Station-course structure inspired by NSCA; passport invented. | Core |
| Era Tour | Targets with chronological visual themes | Finish a short activity, then illuminate its matching gun-wall chapter and artwork. | Museum/activity co-location inspired by NSC; linkage invented. | Core |
| Carnival Stack | Reactive stacked props | Remove marked props to reveal a collectible; reset deterministically each round. | Invented carnival game; stylized physics. | Later |
| Memory Mural | Stationary patterned tiles | View a short pattern, then reproduce it; optional persistent preview. | Invented puzzle activity. | Later |
| Rhythm Windows | Pulsing geometric targets | Select targets during broad musical windows; visual beat indicator and non-audio cues. | Invented rhythm activity. | Later |
| Shared Mosaic | Cooperative paper/digital mural | Players fill separate portions of one mural; shared completion, no penalties for slower partners. | Team category inspiration from ISSF; cooperative rule invented. | Later |
| Relay of Lights | Cooperative sequential stations | Each player completes a shape group to pass an illuminated baton; asynchronous option. | Invented social activity. | Later |
| Daily Remix | Seeded combination of supported targets | A published seed produces the same preset; separate boards by version and assist settings. | Repeatable-preset inspiration from SCSA; generation invented. | Later |

## Reusable configuration proposal

Separate scene placement from activity behavior. One lane can host many presets; each activity can run in multiple lanes. Values below are logical game parameters, never real facility specifications.

```ts
type ActivityPreset = {
  schemaVersion: 1;
  id: string;
  revision: number;
  title: string;
  family: 'paper' | 'reactive' | 'moving' | 'flying' | 'puzzle' | 'mixed';
  presentation: {
    themeId: string;
    eraChapterId?: string;
    displayAssetIds?: string[];
    targetSkin: 'paper' | 'plate' | 'disc' | 'digital' | 'prop';
  };
  targets: {
    poolSize: number;           // bounded actor pool
    shapeSet: string[];
    sizeClass: 'large' | 'medium' | 'small';
    depthBand: 'near' | 'middle' | 'far'; // authored game-space anchors
    motion: 'static' | 'rail' | 'oscillate' | 'arc' | 'authored';
    motionPresetId?: string;
    response: 'mark' | 'flash' | 'fall' | 'hide' | 'fragment';
    reset: 'perHit' | 'perRound' | 'manual';
  };
  sequence: {
    seed?: string;
    mode: 'allVisible' | 'ordered' | 'waves' | 'single' | 'pairs';
    rounds: number;
    eventBudget: number;
    clock: 'none' | 'elapsed' | 'countdown' | 'rhythm';
    durationSeconds?: number;
    pauseBetweenRounds: boolean;
  };
  scoring: {
    mode: 'completion' | 'zones' | 'count' | 'time' | 'pattern';
    combo: boolean;
    retry: 'unlimited' | 'round' | 'session';
    leaderboardPolicy: 'off' | 'presetRevisionAndAssistProfile';
  };
  participation: {
    mode: 'solo' | 'parallel' | 'shared' | 'relay';
    playerLimit: number;
    turnPolicy: 'simultaneous' | 'alternating' | 'asynchronous';
  };
  accessibility: {
    timerOptional: boolean;
    motionScale: number;
    targetScale: number;
    cueMode: 'iconTextAndColor' | 'iconAndText';
    captions: boolean;
    flashReduction: boolean;
    persistentSequencePreview: boolean;
    seatedInteraction: boolean;
    aimAssistProfile: string;
  };
  progression: {
    completionBadgeId?: string;
    cosmeticUnlockIds: string[];
    nextPresetIds: string[];
  };
};
```

Keep global accessibility preferences outside presets and apply them as overrides. Identify targets with shape plus icon/text as well as color. Separate music, machinery, and confirmation sound volumes. Provide pause, predictable previews, reduced camera motion, target enlargement, and a button-based interaction path for panels. Accessibility settings should not block exhibition chapters or ordinary progression; competitive comparison can use explicit compatible profiles.

Runtime events should include `sessionStarted`, `roundStarted`, `targetPresented`, `targetSelected`, `targetResolved`, `roundEnded`, and `sessionEnded`. Attach session, preset revision, target ID, player ID, and monotonic timestamp. Maintain an explicit idle/preview/active/paused/results/reset state machine; never infer results from disappearing meshes. Shared target state and score authority need a later multiplayer design decision.

## Delivery priorities

**Core prototype:** Maker traversal, chronological wall/artwork integration, lane selection panel, one reusable target pool, stationary paper and reactive plate targets, rail motion, simple disc arcs, session reset/results, configuration validation, untimed mode, and a few authored presets. Station Passport and Era Tour should reuse those primitives. The larger campus can initially contain clearly labeled future halls.

**Later:** rhythm/puzzle props, stylized destructible stacks, multiplayer/shared state, seeded daily playlists, leaderboard services, persistent collectibles, user preset sharing, advanced physics, and soldier-style avatar. These should not delay a playable first lane and a convincing large setting.

**Validation gates:** verify start/pause/reset/retry, stable scores after target reuse, motion-stop behavior, deterministic seeded sequences, icon/text readability, reduced-flash mode, untimed completion, and stable performance when distant lanes are inactive. These are software/gameplay checks; they do not validate any real-world range design.
