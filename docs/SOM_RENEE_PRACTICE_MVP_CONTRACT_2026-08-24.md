# SOM Renee Practice MVP Contract — 2026-08-24

Status: FAST LANE P0 implementation contract. Reviewable branch only. No production deploy or main-branch merge under this packet.

## Goal

Deliver the smallest real closed loop for one Renee-style assignment:

`lesson -> homework -> approved practice asset -> in-app practice -> attempt evidence -> teacher-visible result -> next teaching decision`

## Authority

- MOTESART = teacher and instructional authority.
- WYL = learns which interventions and practice progressions work for the student.
- DPM = engagement/drive/passion/motivation and related practice-state evidence.
- TAMi = narrator/learning companion; never the teacher or learner-state authority.
- Motesart Number System canonical methodology version must be carried through converter/curriculum/practice objects.

## Perfect Practice rule

Wrong repetitions are not successful repetitions. Attempt evidence must distinguish at minimum:

- successful clean rep
- failed rep
- successful after hint/correction
- repeated error
- restart/hesitation

Mastery must never be inferred from a single lucky correct rep.

## P0 internal Practice Asset

Minimum fields:

```text
practice_asset_id
student_instrument_id
assignment_id
conversion_id
methodology_version
piece_title
asset_version
section_id
section_label
measure_start
measure_end
concept_ids[]
assigned_tempo_bpm
min_tempo_bpm
max_tempo_bpm
loop_allowed
source_provenance
teacher_approved
rights_status
private_internal_only
```

The manipulable structured practice representation remains private inside SOM. Static approved charts/PDFs may be exported separately.

## P0 Practice Attempt event

Minimum event fields:

```text
attempt_id
practice_asset_id
assignment_id
student_instrument_id
section_id
concept_id
attempted_tempo_bpm
successful_tempo_bpm
rep_number
result
notes_attempted
notes_correct
accuracy_pct
restart_count
hesitation_count
mistake_tags[]
hint_used
intervention_type
clean_rep
created_at
```

Where the current Practice_Events schema cannot yet carry a field directly, adapt without destroying existing semantics; document the temporary mapping.

## Tempo behavior

P0 is bounded and teacher-directed:

1. Start at assigned tempo.
2. Student may reduce/increase within approved range.
3. System records attempted tempo and result.
4. Teacher view shows stable/unstable evidence.
5. No automatic tempo escalation beyond an explicitly bounded experiment in this branch.

Future WYL behavior may learn the best sequence (hold / increase / isolate / reduce), but P0 must capture enough evidence to support that later.

## Student practice surface

Must support, at minimum:

- open assigned practice asset
- play/start section
- loop selected approved section
- adjust tempo within bounds
- record an attempt result
- show remaining target/clean-rep objective without presenting failed reps as success

## Teacher review surface

Minimum evidence:

- student
- assignment
- piece/version/section
- assigned tempo
- attempted tempos
- highest stable successful tempo
- clean reps
- failed reps
- restart/hesitation evidence
- mistake tags
- latest result
- teacher note / next action

## Security and privacy

P0 must not weaken authentication or ownership checks.

- no public student-private practice asset URLs
- no cross-student reads
- teacher/student role checks remain required
- no automatic camera analysis
- no student video collection in this P0 unless an already-secure private upload path can be reused without widening permissions

## Acceptance demo

Using safe seeded/demo data if necessary:

1. Open a Renee-style homework assignment.
2. Launch one approved practice asset and section.
3. Set/adjust tempo and loop the section.
4. Record at least one failed and one successful attempt.
5. Teacher view shows the evidence distinctly.
6. Failed reps do not increment clean-rep mastery.
7. The asset carries methodology/version/provenance identifiers.
8. No production data or external communication is changed.

## Evidence required at return

- changed-file list
- branch/commit identity
- test results
- demo path
- exact temporary mappings to existing schemas
- known stubs
- security notes
- blockers requiring founder decision

Principle: **parallel thinking, serialized authority.**
