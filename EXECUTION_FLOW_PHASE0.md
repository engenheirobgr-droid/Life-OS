# Phase 0 - Execution Flow Decisions

This document locks the product and architecture decisions for the next execution-flow improvements before implementation starts.

The goal of Phase 0 is to reduce ambiguity, avoid regressions, and keep the first delivery focused on the highest-value behavior.

## Core product decision

Protocols are templates.

Execution happens in the micro that is currently being worked on.

When a habit starts a focus session, the app should create or use a micro that carries the execution checklist for that session.

The habit remains the daily progress surface in `Hoje > Habitos`, but the focus session becomes the primary execution surface.

## MVP boundary

Phase 1 through the MVP should deliver:

- micro actions can store `protocolId`, `steps`, and `stepLogs`
- a micro created from a habit inherits the habit/protocol execution steps
- the active focus session shows the execution checklist
- marking a step in focus syncs with the originating habit for the current day
- marking a step in the habit syncs with the active linked micro

The MVP does not require a full-screen or hard-blocking focus mode.

That is a later experiment and must be evaluated separately after the synced execution checklist is working.

## Source of truth

The system must use one active source of truth per execution context.

### Protocol

- `protocol.steps` is a template only
- after a protocol is applied, existing habits or micros do not auto-update when the protocol changes

### Habit

- `habit.steps` defines the execution structure of the habit
- `habit.stepLogs[dateKey]` is the daily step state when the habit is being managed directly
- `habit.logs[dateKey]` remains the completion/progress register for the habit

### Micro

- `micro.steps` defines the execution structure of the micro
- `micro.stepLogs[dateKey]` is the execution state of that micro
- when a micro originates from a habit, it becomes the primary execution surface during focus

## Synchronization rules

Synchronization must only happen when there is a clear linkage.

### Required linkage

Bidirectional sync is allowed only when:

- the active micro has `sourceHabitId`
- the habit and the micro represent the same execution session

### Allowed sync behavior

- marking a step in focus updates the linked micro and the linked habit for the current day
- marking a step in the habit updates the active linked micro for the current day
- if there is no active linked micro, habit step updates stay local to the habit

### Forbidden sync behavior

- protocol edits must not mutate saved habit or micro step history
- unrelated micros must never receive habit step updates
- old completed sessions must not be rewritten by a new active session

## Completion rules

Completion must stay explicit and predictable.

### Habit completion

- boolean habit with steps: completed when all steps for the day are done
- timer habit: completed when logged minutes reach `targetValue`
- timer habit steps are supporting guidance, not a hard completion gate
- numeric habit: completed when logged value reaches `targetValue`

### Micro completion

- a micro with steps can be considered ready for completion when all steps are done
- actual micro completion remains an explicit action or happens in the focus closure flow

## Compatibility rules

Existing data must continue working.

- habits without steps must continue behaving exactly as today
- micros without protocol or steps must continue behaving exactly as today
- old habits with steps must keep rendering the current collapsible checklist in `Habitos`
- focus sessions without linked habits must keep working normally
- protocol linkage can be inferred from copied steps when older saved data lacks `protocolId`, but only as a fallback

## UX direction

The execution checklist should surface where the user is acting, not where the plan was configured.

That means:

- keep the current collapsible steps in the habit card
- do not add a "next step" shortcut to the habit card
- show the execution checklist in focus for the active micro or habit-linked session
- consider full-screen focus only after the synced checklist flow proves useful

## Regression guardrails

Any phase after this one should preserve these behaviors:

- opening and editing habits still works without protocol usage
- creating a focus session from a habit still creates a usable micro
- timer habits count real minutes from focus sessions
- notes and focus closure continue linking to the right micro
- today habits and all habits remain distinct surfaces

## Definition of done for Phase 0

Phase 0 is complete when these decisions are fixed and used as the reference for implementation:

1. protocol is a template, not live state
2. active execution happens in the micro/focus context
3. habit and active linked micro sync only when linkage is explicit
4. timer habit completion is driven by minutes, not by checklist count
5. full-screen focus is out of MVP scope
