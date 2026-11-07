# Open questions requiring confirmation

No answer in this document should be inferred from the current UI or mock data. Until these questions are resolved, the application must remain demonstration-only and non-operational.

## Physical reactor and historical data

1. What is the approved `reactor_id` for the single connected biodrying chamber?
2. Are L1/L2/L3 historical lysimeters, separate apparatuses, aeration configurations, data-series labels, or something else?
3. Do any L1/L2/L3 records describe the new connected reactor? If so, provide the mapping and effective dates. If not, what historical identifier should be retained during import?
4. What is the stable `blower_id`, and which PLC or gateway point is the authoritative source of observed blower status?
5. How many temperature sensors are installed at Top, Middle, and Bottom? Provide stable sensor IDs, position mapping, units, valid ranges, calibration metadata, sampling interval, and missing/error semantics.
6. Can sensors move between positions or reactors? If yes, how should effective-dated inventory changes be represented?
7. Which manual daily measurements belong to an experiment, reactor, historical apparatus, sample, or date? Confirm the uniqueness rule before database design.

## Roles and approval workflow

The professor requirement supplied with Issue #1 indicates: Staff records field measurements, Researcher validates, and Professor grants final research/experiment-completion approval. Please confirm:

1. Which daily-record fields may Staff create or edit?
2. Is there an edit window, and who may correct a submitted or validated record?
3. Must every correction preserve the raw value, reason, author, and timestamp?
4. Are the intended states `draft -> submitted -> validated -> certified`, with `rejected` returning to a prior state? Define allowed transitions and comments/reasons.
5. Can Researcher edit raw Staff entries, or only propose revisions and validate/reject them?
6. Does Professor certify individual daily records, an experiment-completion request, or both?
7. Who may request experiment completion, cancel a request, reopen a run, or start the next run?
8. How are users scoped to projects and reactors? May any role see every project?
9. What should appear under “My Actions,” “Pending Approvals,” and activity history for each role?
10. Which identity provider or account lifecycle is approved by the university?

The current database workflow uses a conservative provisional policy while these answers are pending: every project role may enter its own record; only the entry owner may revise or submit it; Staff have a configurable 24-hour window after entry or return; Researchers validate; and Professors certify. Researchers may view only experiment-scoped audit events, Professors may view project-scoped audit events, and Staff have personal activity history but no technical audit access. These choices require professor confirmation and must not be treated as approved research policy.

## Research criteria

1. Which sensors or positions define core temperature, and how are multiple sensors weighted?
2. How is the relevant temperature peak selected and validated?
3. What sampling coverage, gap tolerance, day boundary, averaging method, and slope method are approved for Criterion T?
4. How are Drying Rate (D) and Air Utilization (E) measured and validated?
5. Confirm the complete stopping rule, consecutive-day requirement, and earliest evaluation day.
6. Is the quadratic peak heuristic useful only for visual review, or should it be removed after the validated rule is available?

Criterion T or the quadratic heuristic alone must never be described as the complete stopping rule.

## Notifications and deployment

1. Who may trigger a notification delivery test in a controlled non-production environment?
2. Which fixed recipients are approved for Email and LINE, and how are recipient changes authorized and audited?
3. What delivery, retry, deduplication, retention, and incident requirements apply to real alerts?
4. Should the public Vercel site remain an isolated demo, be access-restricted at the platform level, or be disabled until institutional authentication is ready?
5. Who owns deployment-secret rotation and emergency revocation?
6. What data classification and retention policy applies to research measurements, user identities, audit events, and exported CSV/PDF files?
