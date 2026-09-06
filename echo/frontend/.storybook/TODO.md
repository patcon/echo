# Story extraction progress — participant

Tracking Storybook coverage for the participant-facing UI, so the whole
participant interface can be recreated in Storybook without a backend.

Scope for now: `src/components/participant/**`, plus the participant layout
and route shells that wrap it.

## Done

- [x] `participant/ConversationErrorView`
- [x] `participant/EchoErrorAlert`
- [x] `participant/ParticipantBody`
- [x] `participant/ParticipantConversationAudioContent`
- [x] `participant/ParticipantConversationText`
- [x] `participant/ParticipantEchoMessages`
- [x] `participant/ParticipantOnboardingCards`
- [x] `participant/ParticipantSettingsModal`
- [x] `participant/PermissionErrorModal`
- [x] `participant/SpikeMessage`
- [x] `participant/StopRecordingConfirmationModal`
- [x] `participant/SystemMessage`
- [x] `participant/UserChunkMessage`
- [x] `participant/refine/RefineSelection`
- [x] `participant/verify/ArtefactModal`
- [x] `participant/verify/VerifiedArtefactItem`
- [x] `participant/verify/VerifiedArtefactsList`
- [x] `participant/verify/VerifyArtefact`
- [x] `participant/verify/VerifyArtefactError`
- [x] `participant/verify/VerifyArtefactLoading`
- [x] `participant/verify/VerifyInstructions`
- [x] `participant/verify/VerifySelection`

## To do

### Components

- [ ] `participant/MicrophoneTest` (456 lines) — needs `getUserMedia` /
      `AudioContext` mocking; `.storybook/mocks/media.ts` may already cover part
      of it.
- [ ] `participant/ParticipantInitiateForm` (268 lines) — form states: empty,
      filled, validation errors, submitting, tutorial/consent variants.
- [ ] `participant/ParticipantConversationAudio` (1108 lines) — the recorder
      container. Presentational half is already covered by
      `ParticipantConversationAudioContent`; decide whether the container is
      worth a story or whether more should be extracted into the content
      component first.

### Layout shells (needed to recreate the full interface)

- [ ] `layout/ParticipantHeader` (107 lines)
- [ ] `layout/ParticipantLayout` (50 lines)

### Route-level screens

- [ ] `routes/participant/ParticipantStart` (97 lines)
- [ ] `routes/participant/ParticipantPostConversation` (276 lines)
- [ ] `routes/participant/ParticipantReport` (115 lines)

## Skipped

- `participant/verify/Verify` — 10-line `<Toaster /> + <Outlet />` shell,
  nothing to render.
- `routes/participant/ParticipantConversation` — thin route wrappers around
  `ParticipantConversationAudio` / `ParticipantConversationText`.

## Conventions

- Story names are short and name the state; ordered to follow the user flow.
- Interactive/wired-up states go in a single `Playground` story, separate from
  the pinned single-state stories.
- Fixtures live in `.storybook/fixtures/`, network/browser mocks in
  `.storybook/mocks/`.
- Fixes for Storybook-only rendering differences stay in `.storybook/` or the
  `*.stories.tsx` file — never in production source.
